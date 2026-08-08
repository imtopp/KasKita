import { redirect } from "next/navigation";

import { InviteAcceptView } from "@/components/invite-accept-view";
import { createClient } from "@/lib/supabase/server";

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = first(sp.token) ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = token ? `/invite/accept?token=${encodeURIComponent(token)}` : "/invite/accept";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return <InviteAcceptView token={token} />;
}
