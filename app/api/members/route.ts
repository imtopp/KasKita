import { NextRequest, NextResponse } from "next/server";

import { createServiceClient, getRequester, jsonError } from "@/lib/api-helpers";
import {
  addExistingMemberSchema,
  changeMemberEmailSchema,
  createMemberSchema,
  resetMemberPasswordSchema,
} from "@/lib/types";

const ROLE_VALUES = ["owner", "co_owner", "treasurer", "viewer"] as const;

type AdminClient = ReturnType<typeof createServiceClient>;

async function findManageableMember(
  admin: AdminClient,
  orgId: string,
  userId: string,
  selfId: string,
) {
  if (userId === selfId) {
    return {
      error: jsonError(
        "Tidak bisa melakukan aksi ini pada akunmu sendiri.",
        400,
      ),
    };
  }
  const { data: member } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .single();
  if (!member) {
    return { error: jsonError("Anggota tidak ditemukan.", 404) };
  }
  if (member.role === "owner") {
    return {
      error: jsonError(
        "Aksi ini hanya bisa dilakukan untuk anggota berperan co-owner/bendahara/viewer.",
        400,
      ),
    };
  }
  return { member };
}

async function getMemberRole(
  admin: AdminClient,
  orgId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .single();
  return data?.role ?? null;
}

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) return jsonError("Parameter orgId wajib.", 400);

  const auth = await getRequester(orgId, ["owner", "co_owner"]);
  if (!auth.ok) return auth.response;

  const admin = createServiceClient();
  const { data: members } = await admin
    .from("organization_members")
    .select("id, organization_id, user_id, role, invited_by, joined_at")
    .eq("organization_id", orgId);

  const { data: invitations } = await admin
    .from("invitations")
    .select("email")
    .eq("organization_id", orgId);
  const invitedEmails = new Set(
    (invitations ?? []).map((invitation) => invitation.email.toLowerCase()),
  );

  const result = [];
  for (const member of members ?? []) {
    const { data } = await admin.auth.admin.getUserById(member.user_id);
    if (!data?.user) continue;
    const user = data.user;
    const metadata = user.user_metadata ?? {};
    const name =
      typeof metadata.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name
        : null;
    result.push({
      id: member.id,
      user_id: member.user_id,
      role: member.role,
      email: user.email ?? "?",
      name,
      source: invitedEmails.has((user.email ?? "").toLowerCase())
        ? "email"
        : "manual",
      banned_until: user.banned_until ?? null,
    });
  }

  return NextResponse.json(
    { members: result },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Permintaan tidak valid.", 400);
  }

  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const auth = await getRequester(orgId, ["owner", "co_owner"]);
  if (!auth.ok) return auth.response;

  const admin = createServiceClient();

  if (body.resetPassword === true) {
    const parsed = resetMemberPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0].message, 400);
    }

    const target = await findManageableMember(
      admin,
      orgId,
      parsed.data.userId,
      auth.user.id,
    );
    if (target.error) return target.error;

    const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, {
      password: parsed.data.password,
      user_metadata: { must_change_password: true },
    });
    if (error) {
      return jsonError("Gagal mengatur ulang password. Coba lagi.", 500);
    }

    return NextResponse.json({ success: true });
  }

  if (body.changeEmail === true) {
    const parsed = changeMemberEmailSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0].message, 400);
    }

    const target = await findManageableMember(
      admin,
      orgId,
      parsed.data.userId,
      auth.user.id,
    );
    if (target.error) return target.error;

    const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, {
      email: parsed.data.email.toLowerCase(),
      email_confirm: true,
    });
    if (error) {
      if (/already registered|already been registered/i.test(error.message)) {
        return jsonError("Email ini sudah dipakai akun KasKita lain.", 409);
      }
      return jsonError("Gagal mengganti email. Coba lagi.", 500);
    }

    return NextResponse.json({ success: true });
  }

  if (body.setActive === true) {
    const userId = typeof body.userId === "string" ? body.userId : "";
    const active = body.active === true;
    if (!userId) {
      return jsonError("Data tidak valid.", 400);
    }

    const target = await findManageableMember(
      admin,
      orgId,
      userId,
      auth.user.id,
    );
    if (target.error) return target.error;

    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "none" : "876000h",
    });
    if (error) {
      return jsonError("Gagal mengubah status akun. Coba lagi.", 500);
    }

    return NextResponse.json({ success: true, active });
  }

  if (body.revokeSessions === true) {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return jsonError("Data tidak valid.", 400);
    }

    const target = await findManageableMember(
      admin,
      orgId,
      userId,
      auth.user.id,
    );
    if (target.error) return target.error;

    const { error } = await admin
      .from("auth.sessions")
      .delete()
      .eq("user_id", userId);
    if (error) {
      return jsonError("Gagal memutuskan sesi. Coba lagi.", 500);
    }

    return NextResponse.json({ success: true });
  }

  if (body.existing === true) {
    const parsed = addExistingMemberSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0].message, 400);
    }

    const email = parsed.data.email.toLowerCase();
    const { data: existingUsers } = await admin
      .from("auth.users")
      .select("id")
      .eq("email", email);
    const existingUserId = existingUsers?.[0]?.id;
    if (!existingUserId) {
      return jsonError(
        "Tidak ditemukan akun KasKita dengan email ini. Cek kembali emailnya.",
        404,
      );
    }

    const { data: existingMember } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", existingUserId)
      .single();
    if (existingMember) {
      return jsonError("Email ini sudah menjadi anggota organisasi ini.", 409);
    }

    const { error: memberError } = await admin
      .from("organization_members")
      .insert({
        organization_id: orgId,
        user_id: existingUserId,
        role: parsed.data.role,
        invited_by: auth.user.id,
      });
    if (memberError) {
      return jsonError("Gagal menambahkan anggota. Coba lagi.", 500);
    }

    return NextResponse.json({
      success: true,
      existing: true,
      email: parsed.data.email,
    });
  }

  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0].message, 400);
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.name,
      must_change_password: true,
    },
  });
  if (error) {
    if (/already registered|already been registered/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            "Email ini sudah terdaftar sebagai akun KasKita. Tambahkan sebagai anggota existing.",
          emailExists: true,
        },
        { status: 409 },
      );
    }
    return jsonError("Gagal membuat akun. Coba lagi.", 500);
  }

  const { error: memberError } = await admin.from("organization_members").insert(
    {
      organization_id: orgId,
      user_id: created.user.id,
      role: parsed.data.role,
      invited_by: auth.user.id,
    },
  );
  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return jsonError("Gagal menambahkan anggota. Coba lagi.", 500);
  }

  return NextResponse.json({
    success: true,
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
  });
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Permintaan tidak valid.", 400);
  }

  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = body.role as (typeof ROLE_VALUES)[number];

  const auth = await getRequester(orgId, ["owner", "co_owner"]);
  if (!auth.ok) return auth.response;
  if (!userId || !ROLE_VALUES.includes(role)) {
    return jsonError("Data tidak valid.", 400);
  }

  const admin = createServiceClient();
  const { data: member } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .single();
  if (!member) return jsonError("Anggota tidak ditemukan.", 404);

  const actorRole = await getMemberRole(admin, orgId, auth.user.id);
  if (actorRole !== "owner" && (member.role === "owner" || role === "owner")) {
    return jsonError("Hanya owner yang bisa mengubah peran owner.", 403);
  }

  if (userId === auth.user.id && role !== "owner") {
    const { count } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return jsonError(
        "Tidak bisa melepas peran owner terakhir dari dirimu sendiri.",
        400,
      );
    }
  }

  const { error } = await admin
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) return jsonError("Gagal mengubah peran anggota. Coba lagi.", 500);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Permintaan tidak valid.", 400);
  }

  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";

  const auth = await getRequester(orgId, ["owner", "co_owner"]);
  if (!auth.ok) return auth.response;
  if (!userId) return jsonError("Data tidak valid.", 400);

  if (userId === auth.user.id) {
    return jsonError("Tidak bisa menghapus dirimu sendiri dari organisasi.", 400);
  }

  const admin = createServiceClient();
  const { data: member } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .single();
  if (!member) return jsonError("Anggota tidak ditemukan.", 404);

  const actorRole = await getMemberRole(admin, orgId, auth.user.id);
  if (actorRole !== "owner" && member.role === "owner") {
    return jsonError("Hanya owner yang bisa menghapus owner.", 403);
  }

  if (member.role === "owner") {
    const { count } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      return jsonError("Tidak bisa menghapus owner terakhir.", 400);
    }
  }

  const { error } = await admin
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) return jsonError("Gagal menghapus anggota. Coba lagi.", 500);

  return NextResponse.json({ success: true });
}
