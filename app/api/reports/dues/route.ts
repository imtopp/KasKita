import { NextRequest, NextResponse } from "next/server";

import { getRequester, jsonError } from "@/lib/api-helpers";
import {
  generateDuesReportPdf,
  type DuesReportCategory,
  type DuesReportPayer,
  type DuesReportTx,
} from "@/lib/pdf/dues-report";
import { createClient } from "@/lib/supabase/server";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");
  const yearParam = request.nextUrl.searchParams.get("year");
  if (!orgId) return jsonError("Parameter orgId wajib.", 400);

  const auth = await getRequester(orgId, [
    "owner",
    "co_owner",
    "treasurer",
    "viewer",
  ]);
  if (!auth.ok) return auth.response;

  const parsedYear = parseInt(yearParam ?? "", 10);
  const year = Number.isFinite(parsedYear)
    ? clamp(parsedYear, 2000, 2100)
    : new Date().getFullYear();

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, dues_entity_label")
    .eq("id", orgId)
    .single();
  if (!org) return jsonError("Organisasi tidak ditemukan.", 404);

  const [{ data: payers }, { data: categories }, { data: txs }] =
    await Promise.all([
      supabase
        .from("dues_payers")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("categories")
        .select("id, name, is_dues, dues_default_amount")
        .eq("organization_id", orgId)
        .eq("type", "income")
        .eq("is_deleted", false)
        .eq("is_dues", true)
        .order("name"),
      supabase
        .from("transactions")
        .select("payer_id:dues_payer_id, category_id, dues_period, amount")
        .eq("organization_id", orgId)
        .not("dues_payer_id", "is", null)
        .not("dues_period", "is", null)
        .gte("dues_period", `${year}-01-01`)
        .lte("dues_period", `${year}-12-31`),
    ]);

  const pdf = await generateDuesReportPdf({
    orgName: org.name,
    entityLabel: org.dues_entity_label,
    year,
    payers: (payers ?? []) as DuesReportPayer[],
    duesCategories: (categories ?? []) as DuesReportCategory[],
    transactions: (txs ?? []) as DuesReportTx[],
  });

  const filename = `laporan-iuran-${org.slug}-${year}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}