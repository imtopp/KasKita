"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Receipt } from "lucide-react";

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
import { TransactionFormDialog } from "@/components/transaction-form-dialog";
import { createClient } from "@/lib/supabase/client";
import type { CategoryOption, TransactionRow } from "@/lib/types";
import { cn, formatDateID, formatRupiah } from "@/lib/utils";

const ALL = "__all__";

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
  canManage,
  page,
  totalPages,
  filters,
}: {
  orgId: string;
  transactions: TransactionRow[];
  categories: CategoryOption[];
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasActiveFilters = !!(filters.type || filters.category || filters.from || filters.to);

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

  async function undoDelete(tx: TransactionRow) {
    const { error } = await supabase.from("transactions").insert({
      id: tx.id,
      organization_id: tx.organization_id,
      category_id: tx.category_id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      transaction_date: tx.transaction_date,
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
    router.refresh();
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
    router.refresh();
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
      ) : transactions.length === 0 ? (
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
          {transactions.map((transaction) => (
            <li
              key={transaction.id}
              className="rounded-xl border bg-card p-4 transition-colors duration-200 active:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    {transaction.categories?.name ?? "Tanpa kategori"}
                  </p>
                  {transaction.description && (
                    <p className="break-words text-sm text-muted-foreground">
                      {transaction.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateID(transaction.transaction_date)}
                  </p>
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
        transaction={editing}
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
