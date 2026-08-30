"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { payerSchema } from "@/lib/types";
import type { PayerRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode =
  | { view: "list" }
  | { view: "rename"; payer: PayerRow }
  | { view: "accounts"; payer: PayerRow };

type MemberOption = {
  user_id: string;
  name: string | null;
  email: string;
  role: string;
};

export function PayerManageDialog({
  open,
  onOpenChange,
  orgId,
  entityLabel,
  payers,
  canLink,
  payerTxCount,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  entityLabel: string;
  payers: PayerRow[];
  canLink: boolean;
  payerTxCount: Record<string, number>;
  onChange: (payers: PayerRow[]) => void;
}) {
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>({ view: "list" });
  const [nameInput, setNameInput] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkMap, setLinkMap] = useState<Map<string, boolean>>(new Map());
  const [currentPayer, setCurrentPayer] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [members, setMembers] = useState<MemberOption[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PayerRow | null>(null);

  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  });

  const becomeRename = useCallback((payer: PayerRow) => {
    setNameInput(payer.name);
    setServerError(null);
    setMode({ view: "rename", payer });
  }, []);

  const becomeAccounts = useCallback(
    async (payer: PayerRow) => {
      setServerError(null);
      setMode({ view: "accounts", payer });
      if (members === null) {
        const res = await fetch(
          `/api/members?orgId=${encodeURIComponent(orgId)}`,
        );
        const data = await res.json().catch(() => ({}));
        const memberList: MemberOption[] = Array.isArray(data.members)
          ? data.members.map(
              (member: {
                user_id: string;
                name: string | null;
                email: string;
                role: string;
              }) => ({
                user_id: member.user_id,
                name: member.name,
                email: member.email,
                role: member.role,
              }),
            )
          : [];
        setMembers(memberList);
      }
      const { data: memberships } = await supabase
        .from("organization_members")
        .select("user_id, payer_id")
        .eq("organization_id", orgId);
      const next = new Map<string, boolean>();
      const current = new Map<string, string | null>();
      for (const row of memberships ?? []) {
        next.set(row.user_id, row.payer_id === payer.id);
        current.set(row.user_id, row.payer_id);
      }
      setLinkMap(next);
      setCurrentPayer(current);
    },
    [orgId, members, supabase],
  );

  async function addPayer() {
    if (busy) return;
    const parsed = payerSchema.safeParse({ name: nameInput });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setServerError(null);
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { error } = await supabase.from("dues_payers").insert({
      id,
      organization_id: orgId,
      name: parsed.data.name,
    });
    setBusy(false);
    if (error) {
      setServerError(
        /row-level security|permission denied/i.test(error.message)
          ? "Kamu tidak punya izin untuk mengelola " + entityLabel.toLowerCase() + "."
          : /duplicate key/i.test(error.message)
            ? `Nama ${entityLabel.toLowerCase()} ini sudah terdaftar.`
            : "Gagal menyimpan. Coba lagi.",
      );
      return;
    }
    onChange([
      ...payers,
      {
        id,
        organization_id: orgId,
        name: parsed.data.name,
        active: true,
        created_at: new Date().toISOString(),
      },
    ]);
    setNameInput("");
  }

  async function renamePayer() {
    if (!mode.view || mode.view !== "rename" || busy) return;
    const payer = mode.payer;
    const parsed = payerSchema.safeParse({ name: nameInput });
    if (!parsed.success) {
      setServerError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setServerError(null);
    const { error } = await supabase
      .from("dues_payers")
      .update({ name: parsed.data.name })
      .eq("id", payer.id);
    setBusy(false);
    if (error) {
      setServerError(
        /row-level security|permission denied/i.test(error.message)
          ? "Kamu tidak punya izin untuk mengubah data ini."
          : /duplicate key/i.test(error.message)
            ? "Nama ini sudah dipakai."
            : "Gagal menyimpan. Coba lagi.",
      );
      return;
    }
    onChange(
      payers.map((item) =>
        item.id === payer.id ? { ...item, name: parsed.data.name } : item,
      ),
    );
    setMode({ view: "list" });
  }

  async function toggleActive(payer: PayerRow) {
    if (busy) return;
    setBusy(true);
    setServerError(null);
    const next = !payer.active;
    const { error } = await supabase
      .from("dues_payers")
      .update({ active: next })
      .eq("id", payer.id);
    setBusy(false);
    if (error) {
      setServerError(
        /row-level security|permission denied/i.test(error.message)
          ? "Kamu tidak punya izin mengubah status ini."
          : "Gagal mengubah status. Coba lagi.",
      );
      return;
    }
    onChange(
      payers.map((item) =>
        item.id === payer.id ? { ...item, active: next } : item,
      ),
    );
  }

  function requestDelete(payer: PayerRow) {
    const txCount = payerTxCount[payer.id] ?? 0;
    if (txCount > 0) {
      setServerError(
        `${payer.name} sudah punya ${txCount} transaksi iuran. Nonaktifkan saja agar riwayat tetap tersimpan.`,
      );
      return;
    }
    setServerError(null);
    setConfirmDelete(payer);
  }

  async function deletePayer(target: PayerRow | null) {
    if (!target || busy) return;
    setBusy(true);
    setServerError(null);
    const { error } = await supabase
      .from("dues_payers")
      .delete()
      .eq("id", target.id);
    setBusy(false);
    setConfirmDelete(null);
    if (error) {
      setServerError(
        /row-level security|permission denied/i.test(error.message)
          ? "Kamu tidak punya izin untuk menghapus " +
              entityLabel.toLowerCase() +
              "."
          : "Gagal menghapus. Coba lagi.",
      );
      return;
    }
    onChange(payers.filter((item) => item.id !== target.id));
  }

  async function saveLinks() {
    if (!members || busy) return;
    setBusy(true);
    setServerError(null);
    const payerId = mode.view === "accounts" ? mode.payer.id : null;
    if (!payerId) return;
    const changed: Array<{ user_id: string; payer_id: string | null }> = [];
    for (const member of members) {
      const current = currentPayer.get(member.user_id) ?? null;
      const linked = linkMap.get(member.user_id) ?? false;
      let nextValue: string | null;
      if (linked) {
        if (current === payerId) continue;
        nextValue = payerId;
      } else {
        if (current !== payerId) continue;
        nextValue = null;
      }
      changed.push({ user_id: member.user_id, payer_id: nextValue });
    }
    if (changed.length === 0) {
      setBusy(false);
      setMode({ view: "list" });
      return;
    }
    const errors: unknown[] = [];
    for (const row of changed) {
      const { error } = await supabase
        .from("organization_members")
        .update({ payer_id: row.payer_id })
        .eq("organization_id", orgId)
        .eq("user_id", row.user_id);
      if (error) errors.push(error);
    }
    setBusy(false);
    if (errors.length > 0) {
      setServerError("Gagal menyimpan tautan akun. Coba lagi.");
      return;
    }
    setMode({ view: "list" });
  }

  const view = mode.view;
  const viewPayer = view === "rename" || view === "accounts" ? mode.payer : null;
  const labelLower = entityLabel.toLowerCase();
  const payerNameById = new Map(payers.map((payer) => [payer.id, payer.name]));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola {labelLower}</DialogTitle>
          <DialogDescription>
            Daftar {labelLower} untuk pelacakan iuran. Nonaktifkan tanpa
            menghapus agar riwayat tetap tersimpan.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </div>
        )}

        {view === "list" ? (
          <div className="space-y-4">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void addPayer();
              }}
            >
              <Input
                type="text"
                placeholder={`Nama ${labelLower} (contoh: Pak Taufiq)`}
                className="h-11 min-w-0 flex-1"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                aria-label={`Nama ${labelLower}`}
              />
              <Button
                type="submit"
                className="h-11 px-4 text-base"
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                Tambah
              </Button>
            </form>
            {payers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada {labelLower}. Tambahkan di atas.
              </p>
            ) : (
              <ul className="space-y-2">
                {payers.map((payer) => (
                  <li
                    key={payer.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3"
                  >
                    <p
                      className={cn(
                        "min-w-0 text-sm font-medium",
                        !payer.active && "text-muted-foreground",
                      )}
                    >
                      {payer.name}
                      {!payer.active && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canLink && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 px-3 text-sm"
                          disabled={busy}
                          onClick={() => void becomeAccounts(payer)}
                        >
                          <KeyRound className="size-4" aria-hidden />
                          Akun
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 px-3 text-sm"
                        disabled={busy}
                        onClick={() => becomeRename(payer)}
                      >
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-10 px-3 text-sm",
                          !payer.active && "text-destructive",
                        )}
                        disabled={busy}
                        onClick={() => void toggleActive(payer)}
                      >
                        <Power className="size-4" aria-hidden />
                        {payer.active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-10 px-0 text-destructive"
                        aria-label={`Hapus ${payer.name}`}
                        disabled={busy}
                        onClick={() => requestDelete(payer)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {view === "rename" && viewPayer && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void renamePayer();
            }}
          >
            <div className="space-y-2">
              <Label>Nama {labelLower}</Label>
              <Input
                type="text"
                className="h-11"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setMode({ view: "list" })}
                disabled={busy}
              >
                Batal
              </Button>
              <Button type="submit" className="h-11 text-base" disabled={busy}>
                {busy && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        )}

        {view === "accounts" && (
          <div className="space-y-4">
            <p className="text-sm">
              Tautkan akun anggota ke{" "}
              <span className="font-semibold">{viewPayer?.name}</span>. Akun
              yang ditautkan akan melihat status {labelLower} miliknya dengan
              badge {"\u201c"}Kamu{"\u201d"} di halaman Iuran.
            </p>
            {members === null ? (
              <ul className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <li key={index} className="rounded-xl border bg-card p-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-2 h-3 w-56" />
                  </li>
                ))}
              </ul>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada anggota di organisasi ini.
              </p>
            ) : (
              <ul className="space-y-2">
                {members.map((member) => {
                  const linked = linkMap.get(member.user_id) ?? false;
                  const memberPayerId = currentPayer.get(member.user_id) ?? null;
                  const memberPayerName = memberPayerId
                    ? payerNameById.get(memberPayerId)
                    : null;
                  const linkedElsewhere =
                    memberPayerId !== null &&
                    memberPayerId !== viewPayer?.id;
                  return (
                    <li
                      key={member.user_id}
                      className="rounded-xl border bg-card p-3"
                    >
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={linked}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            if (
                              checked &&
                              linkedElsewhere &&
                              viewPayer &&
                              memberPayerName
                            ) {
                              const confirmed = window.confirm(
                                `${member.name ?? member.email} sudah tertaut ke ${memberPayerName}. Pindahkan ke ${viewPayer.name}?`,
                              );
                              if (!confirmed) {
                                event.target.checked = false;
                                return;
                              }
                            }
                            const next = new Map(linkMap);
                            next.set(member.user_id, checked);
                            setLinkMap(next);
                          }}
                          className="size-4"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {member.name ?? member.email}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {member.email}
                          </span>
                          {linkedElsewhere && (
                            <span className="mt-0.5 block text-xs font-medium text-amber-600">
                              Sudah tertaut ke {memberPayerName ?? "warga lain"}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setMode({ view: "list" })}
                disabled={busy}
              >
                Batal
              </Button>
              <Button
                type="button"
                className="h-11 text-base"
                disabled={busy || members === null}
                onClick={() => void saveLinks()}
              >
                {busy && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Simpan tautan
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={confirmDelete !== null}
      onOpenChange={(open) => {
        if (!open) setConfirmDelete(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Hapus {labelLower} {confirmDelete?.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {labelLower.charAt(0).toUpperCase() + labelLower.slice(1)} ini
            belum punya transaksi iuran, jadi aman dihapus permanen. Jika ada
            akun anggota yang tertaut, tautannya ikut dilepas. Tindakan ini
            tidak bisa dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            render={
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={busy}
              />
            }
          >
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            render={
              <Button
                type="button"
                variant="destructive"
                className="h-11 text-base"
                disabled={busy}
                onClick={() => void deletePayer(confirmDelete)}
              />
            }
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}