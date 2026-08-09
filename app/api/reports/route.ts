import { NextRequest, NextResponse } from "next/server";

import { getRequester, jsonError } from "@/lib/api-helpers";
import { generateReportPdf, type PdfTransaction } from "@/lib/pdf/report";
import {
  summarizeMonth,
  type PriorBalanceRow,
  type TransactionSummaryRow,
} from "@/lib/reports-data";
import { createClient } from "@/lib/supabase/server";
import { pad2 } from "@/lib/utils";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");
  const monthParam = request.nextUrl.searchParams.get("month");
  const yearParam = request.nextUrl.searchParams.get("year");
  if (!orgId) return jsonError("Parameter orgId wajib.", 400);

  const auth = await getRequester(orgId, ["owner", "treasurer"]);
  if (!auth.ok) return auth.response;

  const parsedMonth = parseInt(monthParam ?? "", 10);
  const parsedYear = parseInt(yearParam ?? "", 10);
  const now = new Date();
  const month = Number.isFinite(parsedMonth)
    ? clamp(parsedMonth, 1, 12)
    : now.getMonth() + 1;
  const year = Number.isFinite(parsedYear)
    ? clamp(parsedYear, 2000, 2100)
    : now.getFullYear();

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", orgId)
    .single();
  if (!org) return jsonError("Organisasi tidak ditemukan.", 404);

  const firstDay = `${year}-${pad2(month)}-01`;
  const lastDay = `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}`;

  const [{ data: transactions }, { data: priorRows }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "transaction_date, type, amount, description, category_id, categories(name)",
      )
      .eq("organization_id", orgId)
      .gte("transaction_date", firstDay)
      .lte("transaction_date", lastDay)
      .order("transaction_date", { ascending: true }),
    supabase
      .from("transactions")
      .select("amount, type")
      .eq("organization_id", orgId)
      .lt("transaction_date", firstDay),
  ]);

  const { totals, breakdown } = summarizeMonth(
    (transactions ?? []) as TransactionSummaryRow[],
    (priorRows ?? []) as PriorBalanceRow[],
  );

  const pdf = await generateReportPdf({
    orgName: org.name,
    month,
    year,
    totals,
    breakdown,
    transactions: (transactions ?? []) as PdfTransaction[],
  });

  const filename = `laporan-kas-${org.slug}-${year}-${pad2(month)}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
