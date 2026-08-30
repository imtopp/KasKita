import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, ChevronRight } from "lucide-react";

import { AnimatedNumber } from "@/components/animated-number";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  categoryFromEmbedded,
  cn,
  formatDateID,
  formatRupiah,
  MONTH_NAMES,
  pad2,
} from "@/lib/utils";

type TxBrief = {
  id: string;
  category_id: string | null;
  type: "income" | "expense";
  amount: number;
  description: string | null;
  transaction_date: string;
  categories: { name: string } | null;
};

function sumAmounts(rows: { amount: number }[] | null): number {
  return (rows ?? []).reduce((acc, row) => acc + Number(row.amount), 0);
}

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, dues_entity_label")
    .eq("slug", slug)
    .single();
  if (!org) {
    notFound();
  }

  const entityLabel = org.dues_entity_label ?? "Warga";

  const [incomeRes, expenseRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount")
      .eq("organization_id", org.id)
      .eq("type", "income"),
    supabase
      .from("transactions")
      .select("amount")
      .eq("organization_id", org.id)
      .eq("type", "expense"),
  ]);
  const totalIncome = sumAmounts(incomeRes.data);
  const totalExpense = sumAmounts(expenseRes.data);
  const balance = totalIncome - totalExpense;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const firstDay = `${year}-${pad2(month)}-01`;
  const lastDay = `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}`;
  const { data: monthTx } = await supabase
    .from("transactions")
    .select("amount, type")
    .eq("organization_id", org.id)
    .gte("transaction_date", firstDay)
    .lte("transaction_date", lastDay);
  let monthIncome = 0;
  let monthExpense = 0;
  for (const tx of monthTx ?? []) {
    if (tx.type === "income") monthIncome += Number(tx.amount);
    else monthExpense += Number(tx.amount);
  }
  const monthNet = monthIncome - monthExpense;

  const { data: priorTx } = await supabase
    .from("transactions")
    .select("amount, type")
    .eq("organization_id", org.id)
    .lt("transaction_date", firstDay);
  let openingBalance = 0;
  for (const tx of priorTx ?? []) {
    if (tx.type === "income") openingBalance += Number(tx.amount);
    else openingBalance -= Number(tx.amount);
  }
  const closingBalance = openingBalance + monthNet;

  const { data: recent } = await supabase
    .from("transactions")
    .select(
      "id, category_id, type, amount, description, transaction_date, categories(name)",
    )
    .eq("organization_id", org.id)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  const recentNormalized: TxBrief[] = (recent ?? []).map(
    (tx: {
      id: string;
      category_id: string | null;
      type: "income" | "expense";
      amount: number;
      description: string | null;
      transaction_date: string;
      categories: { name: string } | { name: string }[];
    }) => ({
      ...tx,
      categories: categoryFromEmbedded(tx.categories),
    }),
  );

  const { count: activePayers } = await supabase
    .from("dues_payers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("active", true);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{org.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saldo saat ini</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "text-3xl font-bold",
              balance < 0 && "text-destructive",
            )}
          >
            <AnimatedNumber value={balance} />
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Bulan {MONTH_NAMES[month - 1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Saldo awal bulan
            </span>
            <span className="text-sm font-semibold">
              {formatRupiah(openingBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pemasukan</span>
            <span className="text-sm font-semibold text-emerald-600">
              {formatRupiah(monthIncome)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pengeluaran</span>
            <span className="text-sm font-semibold text-destructive">
              {formatRupiah(monthExpense)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Selisih bulan ini
            </span>
            <span className="text-sm font-semibold">
              {formatRupiah(monthNet)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">
              Saldo akhir bulan
            </span>
            <span className="text-sm font-semibold">
              {formatRupiah(closingBalance)}
            </span>
          </div>
        </CardContent>
      </Card>

      {(activePayers ?? 0) > 0 && (
        <Link href={`/org/${slug}/dues`} className="block">
          <Card className="group transition-colors duration-200 hover:border-primary/40 active:bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <ClipboardList className="size-4 text-primary" aria-hidden />
                  Iuran {entityLabel}
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cek status pembayaran {activePayers}{" "}
                {entityLabel.toLowerCase()} aktif pada bulan ini.
              </p>
            </CardContent>
          </Card>
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaksi terbaru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentNormalized.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada transaksi.
            </p>
          ) : (
            recentNormalized.map((tx) => (
              <div
                key={tx.id}
                className="flex items-start justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">
                    {tx.categories?.name ?? "Tanpa kategori"}
                  </p>
                  {tx.description && (
                    <p className="truncate text-sm text-muted-foreground">
                      {tx.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateID(tx.transaction_date)}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    tx.type === "income"
                      ? "text-emerald-600"
                      : "text-destructive",
                  )}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {formatRupiah(tx.amount)}
                </p>
              </div>
            ))
          )}
          {recentNormalized.length > 0 && (
            <Link
              href={`/org/${slug}/transactions`}
              className="block pt-1 text-sm font-medium text-primary"
            >
              Lihat semua transaksi
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
