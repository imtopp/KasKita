"use client";

import { useEffect, useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateMemberDialog } from "@/components/create-member-dialog";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import type { MemberRow } from "@/lib/types";

const ROLE_LABELS: Record<MemberRow["role"], string> = {
  owner: "Owner",
  treasurer: "Bendahara",
  viewer: "Viewer",
};

export function MembersView({
  orgId,
  currentUserId,
}: {
  orgId: string;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<MemberRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function fetchMembers() {
    const res = await fetch(`/api/members?orgId=${encodeURIComponent(orgId)}`);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: data.error, members: data.members };
  }

  async function loadMembers() {
    const result = await fetchMembers();
    if (!result.ok) {
      setError(result.error ?? "Gagal memuat daftar anggota.");
    } else {
      setError(null);
      setMembers(result.members ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    fetchMembers().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error ?? "Gagal memuat daftar anggota.");
      } else {
        setError(null);
        setMembers(result.members ?? []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function changeRole(member: MemberRow, role: MemberRow["role"]) {
    if (member.role === role || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, userId: member.user_id, role }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal mengubah peran.");
      return;
    }
    await loadMembers();
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    setDeleteError(null);
    const res = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, userId: deleting.user_id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setDeleteError(data.error ?? "Gagal menghapus anggota.");
      return;
    }
    setDeleting(null);
    setNotice(`${deleting.name ?? deleting.email} dihapus dari organisasi.`);
    await loadMembers();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Memuat anggota...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Anggota</h1>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="h-11 px-4 text-base"
            onClick={() => setCreateOpen(true)}
          >
            Daftarkan anggota
          </Button>
          <Button
            className="h-11 px-4 text-base"
            onClick={() => setInviteOpen(true)}
          >
            Undang via email
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          {notice}
        </div>
      )}

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Belum ada anggota.
        </div>
      ) : (
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="rounded-xl border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">
                    {member.name ?? member.email}
                  </p>
                  {member.name && (
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {member.source === "email"
                      ? "Diundang via email"
                      : "Didaftarkan manual"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    value={member.role}
                    disabled={busy}
                    onValueChange={(value: string | null) => {
                      if (value) {
                        changeRole(member, value as MemberRow["role"]);
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 w-32 data-[size=default]:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="treasurer">Bendahara</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  {member.user_id !== currentUserId && (
                    <Button
                      variant="destructive"
                      className="h-10 px-3 text-sm"
                      disabled={busy}
                      onClick={() => {
                        setDeleting(member);
                        setDeleteError(null);
                      }}
                    >
                      Hapus
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgId={orgId}
        onInvited={(message) => {
          setNotice(message);
          loadMembers();
        }}
      />
      <CreateMemberDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={orgId}
        onCreated={() => {
          loadMembers();
        }}
      />

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hapus anggota?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `${deleting.name ?? deleting.email} (${ROLE_LABELS[deleting.role]}) akan dikeluarkan dari organisasi ini.`
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
              disabled={busy}
              onClick={confirmDelete}
            >
              {busy ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
