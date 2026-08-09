import { notFound } from "next/navigation";

import { ReportsView } from "@/components/reports-view";
import {
  summarizeMonth,
  type PriorBalanceRow,
  type TransactionSummaryRow,
} from "@/lib/reports-data";
import { createClient } from "@/lib/supabase/server";
import { pad2 } from "@/lib/utils";

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

  const { data: priorRows } = await supabase
    .from("transactions")
    .select("amount, type")
    .eq("organization_id", org.id)
    .lt("transaction_date", firstDay);

  const { totals, breakdown } = summarizeMonth(
    (rows ?? []) as TransactionSummaryRow[],
    (priorRows ?? []) as PriorBalanceRow[],
  );

  return (
    <ReportsView
      orgId={org.id}
      month={month}
      year={year}
      totals={totals}
      breakdown={breakdown}
    />
  );
}
