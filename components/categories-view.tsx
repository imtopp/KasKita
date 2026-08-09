"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
import { CategoryFormDialog } from "@/components/category-form-dialog";
import { createClient } from "@/lib/supabase/client";
import type { CategoryRow } from "@/lib/types";

function CategoryList({
  title,
  items,
  canManage,
  onEdit,
  onDelete,
}: {
  title: string;
  items: CategoryRow[];
  canManage: boolean;
  onEdit: (category: CategoryRow) => void;
  onDelete: (category: CategoryRow) => void;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Belum ada kategori {title.toLowerCase()}.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4"
            >
              <p className="min-w-0 text-sm font-medium">{category.name}</p>
              {canManage && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    className="h-11 px-3 text-sm"
                    onClick={() => onEdit(category)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    className="h-11 px-3 text-sm"
                    onClick={() => onDelete(category)}
                  >
                    Hapus
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CategoriesView({
  orgId,
  categories,
  canManage,
}: {
  orgId: string;
  categories: CategoryRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError(null);
    const { error } = await supabase
      .from("categories")
      .update({ is_deleted: true })
      .eq("id", deleting.id);
    setBusy(false);
    if (error) {
      setDeleteError(
        /row-level security|permission denied/i.test(error.message)
          ? "Kamu tidak punya izin untuk menghapus kategori."
          : "Gagal menghapus kategori. Coba lagi.",
      );
      return;
    }
    setDeleting(null);
    router.refresh();
  }

  const income = categories.filter((c) => c.type === "income");
  const expense = categories.filter((c) => c.type === "expense");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Kategori</h1>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="h-11 px-4 text-base"
          >
            Tambah kategori
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Hanya owner/treasurer yang bisa menambah, mengedit, atau menghapus
          kategori.
        </div>
      )}

      <CategoryList
        title="Pemasukan"
        items={income}
        canManage={canManage}
        onEdit={(category) => {
          setEditing(category);
          setFormOpen(true);
        }}
        onDelete={(category) => {
          setDeleting(category);
          setDeleteError(null);
        }}
      />
      <CategoryList
        title="Pengeluaran"
        items={expense}
        canManage={canManage}
        onEdit={(category) => {
          setEditing(category);
          setFormOpen(true);
        }}
        onDelete={(category) => {
          setDeleting(category);
          setDeleteError(null);
        }}
      />

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        orgId={orgId}
        category={editing}
      />

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hapus kategori?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `Kategori "${deleting.name}" akan ditandai dihapus dan tidak muncul lagi untuk transaksi baru. Transaksi lama yang sudah tercatat tetap tersimpan dan tidak terpengaruh.`
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
  );
}
