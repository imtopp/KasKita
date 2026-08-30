"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Settings2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PayerManageDialog } from "@/components/payer-manage-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PayerRow } from "@/lib/types";
import { MONTH_NAMES, cn, formatDateID, formatRupiah, pad2 } from "@/lib/utils";

type DuesTx = {
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

type DuesCategory = {
  id: string;
  name: string;
  dues_default_amount: number | null;
};

const PERIOD_YEAR_BACK = 5;
const PERIOD_YEAR_FORWARD = 2;

type Status = "lunas" | "cicil" | "belum";

const STATUS_META: Record<
  Status,
  { label: string; className: string; dot: string }
> = {
  lunas: {
    label: "Lunas",
    className: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  cicil: {
    label: "Cicil",
    className: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  belum: {
    label: "Belum bayar",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export function DuesView({
  orgId,
  entityLabel,
  payers,
  duesTransactions,
  duesCategories,
  myPayerId,
  canManage,
  canLink,
}: {
  orgId: string;
  entityLabel: string;
  payers: PayerRow[];
  duesTransactions: DuesTx[];
  duesCategories: DuesCategory[];
  myPayerId: string | null;
  canManage: boolean;
  canLink: boolean;
}) {
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [showInactive, setShowInactive] = useState(false);
  const [historyPayer, setHistoryPayer] = useState<PayerRow | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSession, setManageSession] = useState(0);
  const [payersState, setPayersState] = useState<PayerRow[]>(payers);

  const target = useMemo(
    () =>
      duesCategories.reduce(
        (sum, category) => sum + (category.dues_default_amount ?? 0),
        0,
      ),
    [duesCategories],
  );

  const { paidMap, txByPayer } = useMemo(() => {
    const paidMap = new Map<string, number>();
    const txByPayer = new Map<string, DuesTx[]>();
    const prefix = `${periodYear}-${pad2(periodMonth)}`;
    for (const tx of duesTransactions) {
      if (!tx.dues_payer_id) continue;
      const list = txByPayer.get(tx.dues_payer_id) ?? [];
      list.push(tx);
      txByPayer.set(tx.dues_payer_id, list);
      if (tx.dues_period?.startsWith(prefix)) {
        paidMap.set(
          tx.dues_payer_id,
          (paidMap.get(tx.dues_payer_id) ?? 0) + Number(tx.amount),
        );
      }
    }
    return { paidMap, txByPayer };
  }, [duesTransactions, periodMonth, periodYear]);

  function statusOf(paid: number): Status {
    if (target > 0) {
      if (paid >= target) return "lunas";
      if (paid > 0) return "cicil";
      return "belum";
    }
    return paid > 0 ? "lunas" : "belum";
  }

  const visiblePayers = payersState.filter(
    (payer) => payer.active || showInactive,
  );
  const activePayers = payersState.filter((payer) => payer.active);

  const summary = useMemo(() => {
    let lunas = 0;
    let cicil = 0;
    let belum = 0;
    let collected = 0;
    for (const payer of activePayers) {
      const paid = paidMap.get(payer.id) ?? 0;
      collected += paid;
      const status = statusOf(paid);
      if (status === "lunas") lunas += 1;
      else if (status === "cicil") cicil += 1;
      else belum += 1;
    }
    return { lunas, cicil, belum, collected };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePayers, paidMap, target]);

  const currentYear = now.getFullYear();
  const periodYears = Array.from(
    { length: PERIOD_YEAR_BACK + PERIOD_YEAR_FORWARD + 1 },
    (_, i) => currentYear - PERIOD_YEAR_BACK + i,
  );

  function shiftPeriod(deltaMonth: number) {
    let month = periodMonth - 1 + deltaMonth;
    let year = periodYear;
    while (month < 0) {
      month += 12;
      year -= 1;
    }
    while (month > 11) {
      month -= 12;
      year += 1;
    }
    setPeriodMonth(month + 1);
    setPeriodYear(year);
  }

  const history = historyPayer ? txByPayer.get(historyPayer.id) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Iuran</h1>
          <p className="text-sm text-muted-foreground">
            Status iuran per {entityLabel.toLowerCase()}
          </p>
        </div>
        {canManage && (
          <Button
            className="h-11 px-4 text-base"
            onClick={() => {
              setManageSession((session) => session + 1);
              setManageOpen(true);
            }}
          >
            <Settings2 className="size-4" aria-hidden />
            Kelola {entityLabel.toLowerCase()}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="h-11 w-11 px-0"
          aria-label="Bulan sebelumnya"
          onClick={() => shiftPeriod(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <Select
          value={String(periodMonth)}
          onValueChange={(value: string | null) => {
            if (value) setPeriodMonth(Number(value));
          }}
        >
          <SelectTrigger className="h-11 w-32 data-[size=default]:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(periodYear)}
          onValueChange={(value: string | null) => {
            if (value) setPeriodYear(Number(value));
          }}
        >
          <SelectTrigger className="h-11 w-24 data-[size=default]:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodYears.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="h-11 w-11 px-0"
          aria-label="Bulan berikutnya"
          onClick={() => shiftPeriod(1)}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
        {activePayers.length > 0 && (
          <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="size-4"
            />
            Tampilkan nonaktif
          </label>
        )}
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-600">
              {summary.lunas}
            </p>
            <p className="text-xs text-muted-foreground">Lunas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{summary.cicil}</p>
            <p className="text-xs text-muted-foreground">Cicil</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">
              {summary.belum}
            </p>
            <p className="text-xs text-muted-foreground">Belum bayar</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            {summary.lunas}/{activePayers.length} {entityLabel.toLowerCase()}{" "}
            lunas
          </span>
          <span className="font-semibold">
            Masuk {formatRupiah(summary.collected)}
          </span>
        </div>
      </Card>

      {myPayerId && (
        <Link
          href={`#payer-${myPayerId}`}
          className="block rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          {entityLabel} kamu:{" "}
          <span className="font-semibold">
            {payersState.find((payer) => payer.id === myPayerId)?.name ??
              "—"}
          </span>{" "}
          → lihat status di bawah.
        </Link>
      )}

      {activePayers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={`Belum ada ${entityLabel.toLowerCase()} terdaftar`}
          description={
            canManage
              ? `Daftarkan ${entityLabel.toLowerCase()} dulu supaya pembayaran iuran bisa di-track per ${entityLabel.toLowerCase()}.`
              : `Owner/bendahara harus mendaftarkan ${entityLabel.toLowerCase()} dulu agar iuran bisa di-track.`
          }
          action={
            canManage ? (
              <Button
                className="h-11 px-4 text-base"
                onClick={() => {
                  setManageSession((session) => session + 1);
                  setManageOpen(true);
                }}
              >
                Kelola {entityLabel.toLowerCase()}
              </Button>
            ) : undefined
          }
        />
      ) : visiblePayers.length === 0 ? (
        <EmptyState
          icon={CircleDashed}
          compact
          title="Semua unit nonaktif"
          description="Aktifkan setidaknya satu unit atau centang 'Tampilkan nonaktif'."
        />
      ) : (
        <ul className="space-y-2">
          {visiblePayers.map((payer) => {
            const paid = paidMap.get(payer.id) ?? 0;
            const status = statusOf(paid);
            const meta = STATUS_META[status];
            return (
              <li
                key={payer.id}
                id={`payer-${payer.id}`}
                className={cn(
                  "rounded-xl border bg-card p-4 transition-colors duration-200",
                  payer.id === myPayerId && "border-primary/40",
                  !payer.active && "opacity-60",
                )}
              >
                <button
                  type="button"
                  disabled={!txByPayer.has(payer.id)}
                  className="flex w-full items-center justify-between gap-3 text-left active:bg-muted/40"
                  onClick={() => setHistoryPayer(payer)}
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{payer.name}</span>
                      {payer.id === myPayerId && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Kamu
                        </span>
                      )}
                      {!payer.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {target > 0 && paid > 0 && paid < target
                        ? `Terbayar ${formatRupiah(paid)} dari ${formatRupiah(target)}`
                        : paid > 0
                          ? `Terbayar ${formatRupiah(paid)}`
                          : target > 0
                            ? `Iuran ${formatRupiah(target)}`
                            : "Belum ada pembayaran"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {status === "lunas" && (
                      <CheckCircle2 className="size-5 text-emerald-500" aria-hidden />
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        meta.className,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
                      {meta.label}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!canManage && payersState.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Belum ada data iuran di organisasi ini.
        </p>
      )}

      <PayerManageDialog
        key={manageSession}
        open={manageOpen}
        onOpenChange={setManageOpen}
        orgId={orgId}
        entityLabel={entityLabel}
        payers={payersState}
        canLink={canLink}
        onChange={setPayersState}
      />

      <Dialog
        open={!!historyPayer}
        onOpenChange={(open) => !open && setHistoryPayer(null)}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Riwayat {historyPayer?.name ?? ""}
            </DialogTitle>
            <DialogDescription>
              Semua pembayaran iuran {entityLabel.toLowerCase()} ini.
            </DialogDescription>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada transaksi iuran tercatat.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...history]
                .sort((a, b) =>
                  (b.dues_period ?? "").localeCompare(a.dues_period ?? ""),
                )
                .map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">
                        {tx.dues_period
                          ? `${MONTH_NAMES[
                              Number(tx.dues_period.slice(5, 7)) - 1
                            ]} ${tx.dues_period.slice(0, 4)}`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.categories?.name ?? "Tanpa kategori"} · dibayar{" "}
                        {formatDateID(tx.transaction_date)}
                      </p>
                      {tx.description && (
                        <p className="break-words text-xs text-muted-foreground">
                          {tx.description}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-emerald-600">
                      {formatRupiah(tx.amount)}
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}