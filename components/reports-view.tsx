"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryBreakdown, MonthTotals } from "@/lib/types";
import { MONTH_NAMES, formatRupiah } from "@/lib/utils";

const YEAR_RANGE = 10;

export function ReportsView({
  month,
  year,
  totals,
  breakdown,
}: {
  month: number;
  year: number;
  totals: MonthTotals;
  breakdown: CategoryBreakdown[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  function setPeriod(updates: Record<string, string>) {
    const params = new URLSearchParams();
    params.set("month", String(month));
    params.set("year", String(year));
    for (const [key, value] of Object.entries(updates)) {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const years = Array.from(
    { length: YEAR_RANGE + 1 },
    (_, i) => currentYear - i,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Laporan</h1>
        <div className="flex gap-2">
          <Select
            value={String(month)}
            onValueChange={(value: string | null) => {
              if (value) setPeriod({ month: value });
            }}
          >
            <SelectTrigger className="h-11 w-32 data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={index} value={String(index + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(year)}
            onValueChange={(value: string | null) => {
              if (value) setPeriod({ year: value });
            }}
          >
            <SelectTrigger className="h-11 w-24 data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {MONTH_NAMES[month - 1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Saldo awal bulan
            </span>
            <span className="text-sm font-semibold">
              {formatRupiah(totals.openingBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Total pemasukan
            </span>
            <span className="text-sm font-semibold text-emerald-600">
              {formatRupiah(totals.income)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Total pengeluaran
            </span>
            <span className="text-sm font-semibold text-destructive">
              {formatRupiah(totals.expense)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Selisih bulan ini
            </span>
            <span className="text-sm font-semibold">
              {formatRupiah(totals.net)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">
              Saldo akhir bulan
            </span>
            <span className="text-sm font-semibold">
              {formatRupiah(totals.closingBalance)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rincian per kategori</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada transaksi di bulan ini.
            </p>
          ) : (
            breakdown.map((item, index) => (
              <div
                key={item.name + index}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.type === "income" ? "Pemasukan" : "Pengeluaran"}
                  </p>
                </div>
                <p
                  className={
                    item.type === "income"
                      ? "shrink-0 text-sm font-semibold text-emerald-600"
                      : "shrink-0 text-sm font-semibold text-destructive"
                  }
                >
                  {formatRupiah(item.total)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
