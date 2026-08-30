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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteOrgReceipts } from "@/lib/receipts";
import { createClient } from "@/lib/supabase/client";

export function OrgDeleteButton({
  orgId,
  orgName,
}: {
  orgId: string;
  orgName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const matches = confirm === orgName;

  async function confirmDelete() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);

    // Hapus dulu semua file bukti milik org (biar tidak ada file yatim yang
    // numpuk sampai limit storage). Kalau gagal, batalkan hapus org.
    try {
      await deleteOrgReceipts(supabase, orgId);
    } catch {
      setBusy(false);
      setError("Gagal menghapus file bukti organisasi. Coba lagi.");
      return;
    }

    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", orgId);

    setBusy(false);
    if (error) {
      setError(
        /row-level security|permission denied/i.test(error.message)
          ? "Hanya owner yang bisa menghapus organisasi."
          : "Gagal menghapus organisasi. Coba lagi.",
      );
      return;
    }

    setRedirecting(true);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className="h-11 w-full text-base sm:w-auto sm:px-6"
        onClick={() => {
          setConfirm("");
          setError(null);
          setOpen(true);
        }}
      >
        Hapus organisasi
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) {
            setOpen(false);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hapus organisasi?</DialogTitle>
            <DialogDescription>
              Seluruh data &quot;{orgName}&quot; — transaksi, kategori, dan anggota
              — akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="deleteConfirm">
              Ketik nama organisasi untuk konfirmasi
            </Label>
            <Input
              id="deleteConfirm"
              type="text"
              className="h-11"
              placeholder={orgName}
              autoComplete="off"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" className="h-11" />}
            >
              Batal
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              className="h-11 text-base"
              disabled={!matches || busy || redirecting}
              onClick={confirmDelete}
            >
              {busy || redirecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Menghapus...
                </>
              ) : (
                "Hapus permanen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
