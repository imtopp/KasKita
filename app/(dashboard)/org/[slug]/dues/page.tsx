import { notFound, redirect } from "next/navigation";

import { DuesView } from "@/components/dues-view";
import { createClient } from "@/lib/supabase/server";
import { categoryFromEmbedded } from "@/lib/utils";

type DuesTxRow = {
  id: string;
  category_id: string | null;
  type: "income" | "expense";
  amount: number;
  description: string | null;
  transaction_date: string;
  dues_payer_id: string | null;
  dues_period: string | null;
  categories: { name: string } | null;
};

export default async function DuesPage({
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
    .select("id, name, slug, dues_entity_label")
    .eq("slug", slug)
    .single();
  if (!org) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, payer_id")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();

  const role = membership?.role ?? null;
  const canManage =
    role === "owner" || role === "co_owner" || role === "treasurer";
  const canLink = role === "owner" || role === "co_owner";

  const [payersRes, txsRes, duesCategoriesRes] = await Promise.all([
    supabase
      .from("dues_payers")
      .select("id, organization_id, name, active, created_at")
      .eq("organization_id", org.id)
      .order("name"),
    supabase
      .from("transactions")
      .select(
        "id, category_id, type, amount, description, transaction_date, dues_payer_id, dues_period, categories(name)",
      )
      .eq("organization_id", org.id)
      .not("dues_payer_id", "is", null),
    supabase
      .from("categories")
      .select("id, name, is_dues, dues_default_amount")
      .eq("organization_id", org.id)
      .eq("type", "income")
      .eq("is_deleted", false)
      .eq("is_dues", true)
      .order("name"),
  ]);

  const duesTransactions: DuesTxRow[] = (txsRes.data ?? []).map(
    (tx: {
      id: string;
      category_id: string | null;
      type: "income" | "expense";
      amount: number;
      description: string | null;
      transaction_date: string;
      dues_payer_id: string | null;
      dues_period: string | null;
      categories: { name: string } | { name: string }[];
    }) => ({
      ...tx,
      categories: categoryFromEmbedded(tx.categories),
    }),
  );

  const duesCategories =
    (duesCategoriesRes.data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      dues_default_amount: category.dues_default_amount,
    })) ?? [];

  return (
    <DuesView
      orgId={org.id}
      entityLabel={org.dues_entity_label}
      payers={payersRes.data ?? []}
      duesTransactions={duesTransactions}
      duesCategories={duesCategories}
      myPayerId={membership?.payer_id ?? null}
      canManage={canManage}
      canLink={canLink}
    />
  );
}