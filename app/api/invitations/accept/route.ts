import { NextRequest, NextResponse } from "next/server";

import { createServiceClient, jsonError } from "@/lib/api-helpers";
import { createClient } from "@/lib/supabase/server";

async function findInvitation(admin: ReturnType<typeof createServiceClient>, token: string) {
  if (!token) return { error: jsonError("Token undangan wajib.", 400) };
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, organization_id, email, role, invited_by, status, expires_at")
    .eq("token", token)
    .single();
  if (!invitation) return { error: jsonError("Undangan tidak ditemukan.", 404) };
  if (invitation.status !== "pending") {
    return { error: jsonError("Undangan ini sudah dipakai atau dibatalkan.", 400) };
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return { error: jsonError("Undangan ini sudah kedaluwarsa.", 400) };
  }
  return { invitation };
}

async function orgInfo(admin: ReturnType<typeof createServiceClient>, orgId: string) {
  const { data } = await admin
    .from("organizations")
    .select("name, slug")
    .eq("id", orgId)
    .single();
  return { name: data?.name ?? "", slug: data?.slug ?? "" };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const admin = createServiceClient();
  const found = await findInvitation(admin, token);
  if (found.error) return found.error;

  const info = await orgInfo(admin, found.invitation.organization_id);
  return NextResponse.json(
    {
      invitation: {
        organizationName: info.name,
        organizationSlug: info.slug,
        role: found.invitation.role,
      },
    },
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

  const token = typeof body.token === "string" ? body.token : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return jsonError("Silakan masuk terlebih dahulu.", 401);
  }

  const admin = createServiceClient();
  const found = await findInvitation(admin, token);
  if (found.error) return found.error;

  if (found.invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return jsonError("Undangan ini ditujukan untuk email lain.", 403);
  }

  const { error: memberError } = await admin.from("organization_members").insert(
    {
      organization_id: found.invitation.organization_id,
      user_id: user.id,
      role: found.invitation.role,
      invited_by: found.invitation.invited_by,
    },
  );
  if (memberError) {
    if (/duplicate key value violates unique constraint/i.test(memberError.message)) {
      return jsonError("Kamu sudah menjadi anggota organisasi ini.", 409);
    }
    return jsonError("Gagal menerima undangan. Coba lagi.", 500);
  }

  await admin
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", found.invitation.id);

  const info = await orgInfo(admin, found.invitation.organization_id);
  return NextResponse.json({
    success: true,
    organizationSlug: info.slug,
    organizationName: info.name,
    role: found.invitation.role,
  });
}
