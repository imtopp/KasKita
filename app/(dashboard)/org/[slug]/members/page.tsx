import { notFound, redirect } from "next/navigation";

import { Forbidden } from "@/components/forbidden";
import { MembersView } from "@/components/members-view";
import { createClient } from "@/lib/supabase/server";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", slug)
    .single();
  if (!org) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return <Forbidden fallbackHref={`/org/${slug}/dashboard`} />;
  }

  return <MembersView orgId={org.id} currentUserId={user.id} />;
}
