import { notFound } from "next/navigation";

import { ReportsView } from "@/components/reports-view";
import { createClient } from "@/lib/supabase/server";
import type { CategoryBreakdown, MonthTotals } from "@/lib/types";
import { categoryFromEmbedded, pad2 } from "@/lib/utils";

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!org) {
    notFound();
  }

  const now = new Date();
  const parsedMonth = parseInt(first(sp.month) ?? "", 10);
  const parsedYear = parseInt(first(sp.year) ?? "", 10);
  const month = Number.isFinite(parsedMonth)
    ? clamp(parsedMonth, 1, 12)
    : now.getMonth() + 1;
  const year = Number.isFinite(parsedYear)
    ? clamp(parsedYear, 2000, 2100)
    : now.getFullYear();

  const firstDay = `${year}-${pad2(month)}-01`;
  const lastDay = `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}`;

  const { data: rows } = await supabase
    .from("transactions")
    .select("amount, type, category_id, categories(name)")
    .eq("organization_id", org.id)
    .gte("transaction_date", firstDay)
    .lte("transaction_date", lastDay);

  let income = 0;
  let expense = 0;
  const byCategory = new Map<string, CategoryBreakdown>();
  type ReportRow = {
    amount: number;
    type: "income" | "expense";
    category_id: string | null;
    categories: { name: string }[] | { name: string } | null;
  };
  for (const row of (rows ?? []) as ReportRow[]) {
    const amount = Number(row.amount);
    if (row.type === "income") income += amount;
    else expense += amount;

    const name =
      categoryFromEmbedded(row.categories)?.name ?? "Tanpa kategori";
    const key = row.category_id ?? "none";
    const current = byCategory.get(key);
    if (current) {
      current.total += amount;
    } else {
      byCategory.set(key, { name, type: row.type, total: amount });
    }
  }

  const breakdown = [...byCategory.values()].sort((a, b) => b.total - a.total);
  const totals: MonthTotals = { income, expense, net: income - expense };

  return (
    <ReportsView
      month={month}
      year={year}
      totals={totals}
      breakdown={breakdown}
    />
  );
}
