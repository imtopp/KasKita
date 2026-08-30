import { notFound, redirect } from "next/navigation";

import { CategoriesView } from "@/components/categories-view";
import { createClient } from "@/lib/supabase/server";

export default async function CategoriesPage({
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
    .select("id")
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
  const canManage =
    membership?.role === "owner" ||
    membership?.role === "co_owner" ||
    membership?.role === "treasurer";

  const { data: categories } = await supabase
    .from("categories")
    .select(
      "id, organization_id, name, type, is_dues, dues_default_amount, is_deleted, created_at",
    )
    .eq("organization_id", org.id)
    .eq("is_deleted", false)
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  return (
    <CategoriesView
      orgId={org.id}
      categories={categories ?? []}
      canManage={canManage}
    />
  );
}
