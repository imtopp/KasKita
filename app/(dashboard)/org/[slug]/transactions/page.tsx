import { notFound, redirect } from "next/navigation";

import { TransactionsView } from "@/components/transactions-view";
import { createClient } from "@/lib/supabase/server";
import { categoryFromEmbedded } from "@/lib/utils";

const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
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

  const type = first(sp.type);
  const category = first(sp.category);
  const from = first(sp.from);
  const to = first(sp.to);
  const page = Math.max(1, parseInt(first(sp.page) ?? "1", 10) || 1);

  let query = supabase
    .from("transactions")
    .select(
      "id, organization_id, category_id, type, amount, description, transaction_date, receipt_url, dues_payer_id, dues_period, created_by, categories(name), dues_payers(name)",
      { count: "exact" },
    )
    .eq("organization_id", org.id);

  if (type === "income" || type === "expense") {
    query = query.eq("type", type);
  }
  if (category) {
    query = query.eq("category_id", category);
  }
  if (from) {
    query = query.gte("transaction_date", from);
  }
  if (to) {
    query = query.lte("transaction_date", to);
  }

  query = query
    .order("transaction_date", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data: transactions, count } = await query;

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, type, is_dues, dues_default_amount")
    .eq("organization_id", org.id)
    .eq("is_deleted", false)
    .order("name");

  const { data: payers } = await supabase
    .from("dues_payers")
    .select("id, organization_id, name, active, created_at")
    .eq("organization_id", org.id)
    .eq("active", true)
    .order("name");

  const { data: orgDetails } = await supabase
    .from("organizations")
    .select("dues_entity_label")
    .eq("id", org.id)
    .single();
  const entityLabel = orgDetails?.dues_entity_label ?? "Warga";

  const { data: paidPeriods } = await supabase
    .from("transactions")
    .select("dues_payer_id, dues_period, amount")
    .eq("organization_id", org.id)
    .not("dues_payer_id", "is", null)
    .not("dues_period", "is", null);

  const paidPeriodsByPayer: Record<string, Record<string, number>> = {};
  for (const row of paidPeriods ?? []) {
    if (!row.dues_payer_id || !row.dues_period) continue;
    const key = row.dues_period.slice(0, 7);
    const map = (paidPeriodsByPayer[row.dues_payer_id] ??= {});
    map[key] = (map[key] ?? 0) + row.amount;
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const normalized = (transactions ?? []).map(
    (transaction: {
      id: string;
      organization_id: string;
      category_id: string | null;
      type: "income" | "expense";
      amount: number;
      description: string | null;
      transaction_date: string;
      receipt_url: string | null;
      dues_payer_id: string | null;
      dues_period: string | null;
      created_by: string;
      categories: { name: string } | { name: string }[];
      dues_payers: { name: string } | { name: string }[];
    }) => ({
      ...transaction,
      categories: categoryFromEmbedded(transaction.categories),
      dues_payers: categoryFromEmbedded(transaction.dues_payers),
    }),
  );

  return (
    <TransactionsView
      orgId={org.id}
      transactions={normalized}
      categories={categories ?? []}
      payers={payers ?? []}
      entityLabel={entityLabel}
      paidPeriodsByPayer={paidPeriodsByPayer}
      canManage={canManage}
      page={page}
      totalPages={totalPages}
      filters={{ type: type ?? null, category: category ?? null, from: from ?? null, to: to ?? null }}
    />
  );
}
