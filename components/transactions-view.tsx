"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Paperclip, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/date-input";
import { EmptyState } from "@/components/empty-state";
import { PullToRefresh } from "@/components/pull-to-refresh";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ReceiptViewDialog } from "@/components/receipt-view-dialog";
import { TransactionFormDialog } from "@/components/transaction-form-dialog";
import { deleteReceipt } from "@/lib/receipts";
import { createClient } from "@/lib/supabase/client";
import type {
  CategoryOption,
  PayerRow,
  TransactionRow,
} from "@/lib/types";
import {
  cn,
  dateRangeForPreset,
  formatDateID,
  formatRupiah,
  MONTH_NAMES,
  type DatePresetKey,
} from "@/lib/utils";

const ALL = "__all__";

const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: "today", label: "Hari ini" },
  { key: "7d", label: "7 hari" },
  { key: "month", label: "Bulan ini" },
  { key: "30d", label: "30 hari" },
];

type Filters = {
  type: string | null;
  category: string | null;
  from: string | null;
  to: string | null;
};

export function TransactionsView({
  orgId,
  transactions,
  categories,
  payers,
  entityLabel,
  paidPeriodsByPayer,
  canManage,
  page,
  totalPages,
  filters,
}: {
  orgId: string;
  transactions: TransactionRow[];
  categories: CategoryOption[];
  payers: PayerRow[];
  entityLabel: string;
  paidPeriodsByPayer: Record<string, Record<string, number>>;
  canManage: boolean;
  page: number;
  totalPages: number;
  filters: Filters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const supabase = createClient();

  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [deleting, setDeleting] = useState<TransactionRow | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<TransactionRow | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const formOpenRef = useRef(false);
  const deletingRef = useRef(false);
  useEffect(() => {
    formOpenRef.current = formOpen;
    deletingRef.current = !!deleting;
  });

  // Refresh harus melewati jendela exit+hold popup dialog (~500ms) dan tidak
  // boleh jatuh saat dialog terbuka. Kalau refresh jatuh di jendela itu, page
  // re-render di frame yang sama dengan unmount popup (layer GPU backdrop-blur)
  // sehingga popup "terlihat muncul lagi" sepersekian detik lalu hilang (gejala
  // kambuh yang ter-reproduksi hanya dengan throttling + aksi Simpan; Batal aman).
  // 700ms > exit+hold terpanjang yang teramati (~540ms); kalau ada dialog yang
  // sedang terbuka saat timer tiba, refresh ditunda lagi.
  const scheduleRefresh = useCallback((options?: { silent?: boolean }) => {
    const run = () => {
      if (formOpenRef.current || deletingRef.current) {
        setTimeout(run, 700);
        return;
      }
      if (options?.silent) {
        // Hapus/undo-delete: baris sudah berubah optimistis + ada toast, jadi
        // refresh diam-diam saja (skeleton di sini malah terasa janggal).
        router.refresh();
        return;
      }
      // Tambah/edit: tak ada perubahan visual di list sebelum data baru tiba,
      // jadi refresh dibungkus startTransition agar isPending menyala → daftar
      // berubah jadi skeleton "Memuat..." selama data baru diambil.
      startTransition(() => {
        router.refresh();
      });
    };
    setTimeout(run, 700);
  }, [router, startTransition]);

  const hasActiveFilters = !!(filters.type || filters.category || filters.from || filters.to);
  const duesHref = `/org/${pathname.split("/")[2]}/dues`;

  const visibleTransactions = transactions.filter(
    (transaction) => !removedIds.has(transaction.id),
  );

  function applyParams(
    updates: Record<string, string | null>,
    pageValue: number | null,
  ) {
    const params = new URLSearchParams();
    const source = {
      type: filters.type,
      category: filters.category,
      from: filters.from,
      to: filters.to,
      page: pageValue ? String(pageValue) : null,
      ...updates,
    };
    for (const [key, value] of Object.entries(source)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => {
      router.push(url);
    });
  }

  function setFilter(key: keyof Filters, value: string | null) {
    applyParams({ [key]: value }, null);
  }

  function goToPage(next: number) {
    applyParams({}, next);
  }

  function resetFilters() {
    applyParams(
      { type: null, category: null, from: null, to: null },
      null,
    );
  }

  function setFilterDates(from: string, to: string) {
    applyParams({ from, to }, null);
  }

  async function undoDelete(tx: TransactionRow) {
    const { error } = await supabase.from("transactions").insert({
      id: tx.id,
      organization_id: tx.organization_id,
      category_id: tx.category_id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      transaction_date: tx.transaction_date,
      receipt_url: tx.receipt_url,
      // Atribut iuran wajib ikut dipulihkan: tanpa ini, transaksi iuran yang
      // di-undo kehilangan status "dibayar oleh + periode" (iuran warga jadi
      // berubah) padahal data aslinya sudah DIHAPUS dari DB saat delete — nilai
      // bisa diambil dari object list yang masih pegang salinan lengkap.
      dues_payer_id: tx.dues_payer_id,
      dues_period: tx.dues_period,
      created_by: tx.created_by,
    });
    if (error) {
      toast({
        title: "Gagal memulihkan transaksi",
        description: /row-level security|permission denied/i.test(error.message)
          ? "Kamu tidak punya izin untuk menambahkan transaksi."
          : "Coba lagi atau tambahkan transaksi secara manual.",
        variant: "destructive",
      });
      return;
    }
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.delete(tx.id);
      return next;
    });
    scheduleRefresh({ silent: true });
    toast({
      title: "Transaksi dipulihkan",
      description: `${tx.type === "income" ? "Pemasukan" : "Pengeluaran"} ${formatRupiah(tx.amount)} tanggal ${formatDateID(tx.transaction_date)} kembali dicatat.`,
    });
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError(null);
    const removed = deleting;
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", removed.id);
    setBusy(false);
    if (error) {
      setDeleteError(
        /row-level security|permission denied/i.test(error.message)
          ? "Kamu tidak punya izin untuk menghapus transaksi."
          : "Gagal menghapus transaksi. Coba lagi.",
      );
      return;
    }
    setDeleting(null);
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(removed.id);
      return next;
    });
    // File bukti ikut dihapus dari Storage (auto-delete). Best-effort:
    // gagal hapus file tidak menggagalkan alur karena transaksi sudah terhapus.
    void deleteReceipt(supabase, removed.receipt_url);
    scheduleRefresh({ silent: true });
    toast({
      title: "Transaksi dihapus",
      description: `${removed.type === "income" ? "Pemasukan" : "Pengeluaran"} ${formatRupiah(removed.amount)} tanggal ${formatDateID(removed.transaction_date)} dihapus permanen.`,
      duration: 8000,
      action: {
        label: "Urungkan",
        onClick: () => undoDelete(removed),
      },
    });
  }

  return (
    <PullToRefresh>
      <div className="space-y-4" aria-busy={isPending}>
      {isPending && <span className="sr-only">Memuat...</span>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Transaksi</h1>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              className="h-11 px-4 text-base"
              onClick={() => {
                const slug = pathname.split("/")[2];
                router.push(`/org/${slug}/categories`);
              }}
            >
              Kelola kategori
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="h-11 px-4 text-base"
            >
              Tambah transaksi
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Jenis
          </Label>
          <Select
            value={filters.type ?? ALL}
            onValueChange={(value: string | null) =>
              setFilter("type", value === ALL ? null : value)
            }
          >
            <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
              <SelectValue placeholder="Semua jenis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua jenis</SelectItem>
              <SelectItem value="income">Pemasukan</SelectItem>
              <SelectItem value="expense">Pengeluaran</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Kategori
          </Label>
          <Select
            value={filters.category ?? ALL}
            onValueChange={(value: string | null) =>
              setFilter("category", value === ALL ? null : value)
            }
          >
            <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
              <SelectValue placeholder="Semua kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua kategori</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 min-w-0 space-y-1.5 md:col-span-1">
          <Label
            htmlFor="filterFrom"
            className="text-xs font-medium text-muted-foreground"
          >
            Dari tanggal
          </Label>
          <DateInput
            id="filterFrom"
            value={filters.from ?? ""}
            onChange={(e) => setFilter("from", e.target.value || null)}
          />
        </div>
        <div className="col-span-2 min-w-0 space-y-1.5 md:col-span-1">
          <Label
            htmlFor="filterTo"
            className="text-xs font-medium text-muted-foreground"
          >
            Sampai tanggal
          </Label>
          <DateInput
            id="filterTo"
            value={filters.to ?? ""}
            onChange={(e) => setFilter("to", e.target.value || null)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((preset) => {
          const range = dateRangeForPreset(preset.key);
          const active =
            filters.from === range.from && filters.to === range.to;
          return (
            <Button
              key={preset.key}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              className="h-9 px-3 text-sm"
              onClick={() => setFilterDates(range.from, range.to)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-sm text-muted-foreground">
            Filter aktif sedang menyaring transaksi.
          </p>
          <Button
            variant="outline"
            className="h-11 shrink-0 px-4 text-base"
            onClick={resetFilters}
          >
            Reset filter
          </Button>
        </div>
      )}

      {isPending ? (
        <TransactionListSkeleton />
      ) : visibleTransactions.length === 0 ? (
        <div className="animate-in slide-in-from-bottom-2 fade-in-0 duration-[400ms] ease-out">
          <EmptyState
            icon={Receipt}
            title={
              hasActiveFilters
                ? "Tidak ada transaksi yang cocok"
                : "Belum ada transaksi"
            }
            description={
              hasActiveFilters
                ? "Coba ubah atau reset filter untuk melihat hasil lain."
                : canManage
                  ? "Catat pemasukan dan pengeluaran pertamamu untuk mulai memantau kas organisasi."
                  : "Catatan kas akan tampil di sini setelah ada transaksi."
            }
            action={
              hasActiveFilters
                ? undefined
                : canManage
                  ? (
                      <Button
                        className="h-11 px-4 text-base"
                        onClick={() => {
                          setEditing(null);
                          setFormOpen(true);
                        }}
                      >
                        Tambah transaksi
                      </Button>
                    )
                  : undefined
            }
          />
        </div>
      ) : (
        <ul className="animate-in slide-in-from-bottom-2 fade-in-0 space-y-3 duration-[400ms] ease-out">
          {visibleTransactions.map((transaction) => (
            <li
              key={transaction.id}
              className="rounded-xl border bg-card p-4 transition-colors duration-200 active:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    {transaction.categories?.name ?? "Tanpa kategori"}
                  </p>
                  {transaction.dues_payers?.name && (
                    <p className="text-sm text-muted-foreground">
                      {transaction.dues_payers.name} ·{" "}
                      {transaction.dues_period
                        ? `${MONTH_NAMES[
                            Number(transaction.dues_period.slice(5, 7)) - 1
                          ]} ${transaction.dues_period.slice(0, 4)}`
                        : ""}
                    </p>
                  )}
                  {transaction.description && (
                    <p className="break-words text-sm text-muted-foreground">
                      {transaction.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateID(transaction.transaction_date)}
                  </p>
                  {transaction.receipt_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-9 gap-1 px-3 text-xs"
                      onClick={() => setViewingReceipt(transaction)}
                    >
                      <Paperclip className="size-3.5" aria-hidden />
                      Lihat bukti
                    </Button>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p
                    className={cn(
                      "text-base font-semibold whitespace-nowrap",
                      transaction.type === "income"
                        ? "text-emerald-600"
                        : "text-destructive",
                    )}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatRupiah(transaction.amount)}
                  </p>
                  {canManage && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="h-11 px-3 text-sm"
                        onClick={() => {
                          setEditing(transaction);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-11 px-3 text-sm"
                        onClick={() => {
                          setDeleting(transaction);
                          setDeleteError(null);
                        }}
                      >
                        Hapus
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isPending && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="h-11 px-4"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Sebelumnya
          </Button>
          <p className="text-sm text-muted-foreground">
            Hal {page} dari {totalPages}
          </p>
          <Button
            variant="outline"
            className="h-11 px-4"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        orgId={orgId}
        categories={categories}
        payers={payers}
        entityLabel={entityLabel}
        paidPeriodsByPayer={paidPeriodsByPayer}
        duesHref={duesHref}
        transaction={editing}
        onSaved={scheduleRefresh}
      />

      <ReceiptViewDialog
        open={!!viewingReceipt}
        onOpenChange={(open) => !open && setViewingReceipt(null)}
        receiptUrl={viewingReceipt?.receipt_url ?? null}
      />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hapus transaksi?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `${deleting.type === "income" ? "Pemasukan" : "Pengeluaran"} ${formatRupiah(deleting.amount)} tanggal ${formatDateID(deleting.transaction_date)} akan dihapus permanen.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-11" />}>
              Batal
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              className="h-11 text-base"
              disabled={busy}
              onClick={confirmDelete}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Menghapus...
                </>
              ) : (
                "Hapus"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
}

function TransactionListSkeleton() {
  return (
    <ul className="space-y-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}
