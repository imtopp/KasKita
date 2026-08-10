import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createServiceClient, getRequester, jsonError } from "@/lib/api-helpers";
import { inviteMemberSchema } from "@/lib/types";

function mapInviteError(error: {
  message: string;
  status?: number;
}): { message: string; status: number } {
  if (/invalid|not a valid/i.test(error.message) && error.status === 400) {
    return {
      message: "Alamat email tidak diterima. Periksa kembali alamat email.",
      status: 400,
    };
  }
  if (/already registered|already been registered/i.test(error.message)) {
    return {
      message:
        "Email ini sudah terdaftar sebagai akun. Tambahkan lewat 'Tambah anggota existing'.",
      status: 409,
    };
  }
  if (
    error.status === 429 ||
    /rate|too many|limit/i.test(error.message)
  ) {
    return {
      message: "Terlalu banyak undangan dalam satu jam. Coba lagi nanti.",
      status: 429,
    };
  }
  return { message: "Gagal mengirim undangan. Coba lagi.", status: 500 };
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

  if (body.resend === true) {
    const invitationId =
      typeof body.invitationId === "string" ? body.invitationId : "";
    if (!invitationId) {
      return jsonError("Data tidak valid.", 400);
    }
    const { data: existing } = await admin
      .from("invitations")
      .select("id, email, role, status")
      .eq("organization_id", orgId)
      .eq("id", invitationId)
      .single();
    if (!existing) {
      return jsonError("Undangan tidak ditemukan.", 404);
    }
    if (existing.status !== "pending") {
      return jsonError("Undangan ini sudah dipakai atau dibatalkan.", 400);
    }

    const token = randomUUID();
    const { error: inviteError } = await admin.from("invitations").insert({
      organization_id: orgId,
      email: existing.email,
      role: existing.role,
      invited_by: auth.user.id,
      token,
    });
    if (inviteError) {
      return jsonError("Gagal membuat undangan. Coba lagi.", 500);
    }

    const origin = new URL(request.url).origin;
    const acceptPath = `/invite/accept?token=${token}`;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(acceptPath)}`;

    const { error } = await admin.auth.admin.inviteUserByEmail(
      existing.email,
      { redirectTo },
    );
    if (error) {
      await admin.from("invitations").delete().eq("token", token);
      const mapped = mapInviteError(error);
      return jsonError(mapped.message, mapped.status);
    }

    await admin
      .from("invitations")
      .update({ status: "expired" })
      .eq("id", existing.id);

    return NextResponse.json({
      success: true,
      message: `Undangan dikirim ulang ke ${existing.email}.`,
    });
  }

  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0].message, 400);
  }

  const token = randomUUID();
  const { error: inviteError } = await admin.from("invitations").insert({
    organization_id: orgId,
    email: parsed.data.email,
    role: parsed.data.role,
    invited_by: auth.user.id,
    token,
  });
  if (inviteError) {
    return jsonError("Gagal membuat undangan. Coba lagi.", 500);
  }

  const origin = new URL(request.url).origin;
  const acceptPath = `/invite/accept?token=${token}`;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(acceptPath)}`;

  const { error } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo },
  );
  if (error) {
    await admin.from("invitations").delete().eq("token", token);
    const mapped = mapInviteError(error);
    return jsonError(mapped.message, mapped.status);
  }

  return NextResponse.json({
    success: true,
    message: `Undangan dikirim ke ${parsed.data.email}.`,
  });
}
