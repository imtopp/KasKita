"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, Loader2, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryBreakdown, MonthTotals } from "@/lib/types";
import { MONTH_NAMES, formatRupiah } from "@/lib/utils";

const YEAR_RANGE = 10;

export function ReportsView({
  orgId,
  orgSlug,
  month,
  year,
  totals,
  breakdown,
}: {
  orgId: string;
  orgSlug: string;
  month: number;
  year: number;
  totals: MonthTotals;
  breakdown: CategoryBreakdown[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function setPeriod(updates: Record<string, string>) {
    const params = new URLSearchParams();
    params.set("month", String(month));
    params.set("year", String(year));
    for (const [key, value] of Object.entries(updates)) {
      params.set(key, value);
    }
    const url = `${pathname}?${params.toString()}`;
    startTransition(() => {
      router.push(url);
    });
  }

  async function exportPdf() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch(
        `/api/reports?orgId=${encodeURIComponent(orgId)}&month=${month}&year=${year}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        let message = "Gagal mengunduh PDF. Coba lagi.";
        try {
          const body = await response.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          // Abaikan, pakai pesan default.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `laporan-kas-${orgSlug}-${year}-${String(month).padStart(2, "0")}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Gagal mengunduh PDF. Coba lagi.",
      );
    } finally {
      setExporting(false);
    }
  }

  const years = Array.from(
    { length: YEAR_RANGE + 1 },
    (_, i) => currentYear - i,
  );

  return (
    <div className="space-y-4" aria-busy={isPending}>
      {isPending && <span className="sr-only">Memuat...</span>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Laporan</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-11 px-4 text-base"
            disabled={exporting}
            onClick={exportPdf}
          >
            {exporting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Menyiapkan...
              </>
            ) : (
              <>
                <Download className="size-4" aria-hidden />
                Export PDF
              </>
            )}
          </Button>
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

      {exportError && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {exportError}
        </div>
      )}

      {isPending ? (
        <ReportsSkeleton />
      ) : (
        <>
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
            <EmptyState
              icon={Receipt}
              compact
              title="Belum ada transaksi di bulan ini"
              description="Tambah transaksi di halaman Transaksi agar laporan terisi."
            />
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
        </>
      )}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}
