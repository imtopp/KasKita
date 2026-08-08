"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const supabase = createClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [deleting, setDeleting] = useState<TransactionRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setFilter(key: keyof Filters, value: string | null) {
    applyParams({ [key]: value }, null);
  }

  function goToPage(next: number) {
    applyParams({}, next);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", deleting.id);
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
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Transaksi</h1>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="h-11 px-4 text-base"
          >
            Tambah transaksi
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
        <Input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => setFilter("from", e.target.value || null)}
          className="h-11"
          aria-label="Dari tanggal"
        />
        <Input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => setFilter("to", e.target.value || null)}
          className="h-11"
          aria-label="Sampai tanggal"
        />
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Belum ada transaksi.
        </div>
      ) : (
        <ul className="space-y-3">
          {transactions.map((transaction) => (
            <li
              key={transaction.id}
              className="rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    {transaction.categories?.name ?? "Tanpa kategori"}
                  </p>
                  {transaction.description && (
                    <p className="truncate text-sm text-muted-foreground">
                      {transaction.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateID(transaction.transaction_date)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p
                    className={cn(
                      "text-base font-semibold",
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
                        className="h-10 px-3 text-sm"
                        onClick={() => {
                          setEditing(transaction);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-10 px-3 text-sm"
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

      {totalPages > 1 && (
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
            <DialogClose render={<Button type="button" variant="outline" />}>
              Batal
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              className="h-11 text-base"
              onClick={confirmDelete}
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
