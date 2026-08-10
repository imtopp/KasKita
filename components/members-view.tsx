"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
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
import { MemberManageDialog } from "@/components/member-manage-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import type { MemberRow } from "@/lib/types";

const ROLE_LABELS: Record<MemberRow["role"], string> = {
  owner: "Owner",
  co_owner: "Co-owner",
  treasurer: "Bendahara",
  viewer: "Viewer",
};

export function MembersView({
  orgId,
  currentUserId,
  currentRole,
}: {
  orgId: string;
  currentUserId: string;
  currentRole: "owner" | "co_owner";
}) {
  const isOwner = currentRole === "owner";
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<MemberRow | null>(null);
  const [managing, setManaging] = useState<MemberRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function fetchMembers() {
    const res = await fetch(`/api/members?orgId=${encodeURIComponent(orgId)}`);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: data.error, members: data.members };
  }

  async function loadMembers() {
    setLoading(true);
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
    toast({
      title: "Anggota dihapus",
      description: `${deleting.name ?? deleting.email} dikeluarkan dari organisasi.`,
    });
    await loadMembers();
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Memuat...</span>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-7 w-28" />
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
        <ul className="space-y-2" aria-hidden>
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={index} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-11 w-28" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
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
        <EmptyState
          icon={Users}
          title="Belum ada anggota"
          description="Undang via email atau daftarkan anggota secara manual agar bisa ikut memantau kas."
        />
      ) : (
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="rounded-xl border bg-card p-4 transition-colors duration-200 active:bg-muted/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">
                      {member.name ?? member.email}
                    </span>
                    {member.banned_until && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        Nonaktif
                      </span>
                    )}
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
                    disabled={busy || (!isOwner && member.role === "owner")}
                    onValueChange={(value: string | null) => {
                      if (value) {
                        changeRole(member, value as MemberRow["role"]);
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 w-32 data-[size=default]:h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner" disabled={!isOwner}>
                        Owner
                      </SelectItem>
                      <SelectItem value="co_owner">Co-owner</SelectItem>
                      <SelectItem value="treasurer">Bendahara</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  {member.role !== "owner" &&
                    member.user_id !== currentUserId && (
                      <Button
                        variant="outline"
                        className="h-11 px-3 text-sm"
                        disabled={busy}
                        onClick={() => setManaging(member)}
                      >
                        <KeyRound className="size-4" aria-hidden />
                        Kelola
                      </Button>
                    )}
                  {member.user_id !== currentUserId &&
                    (isOwner || member.role !== "owner") && (
                      <Button
                        variant="destructive"
                        className="h-11 px-3 text-sm"
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
      <MemberManageDialog
        open={!!managing}
        onOpenChange={(open) => !open && setManaging(null)}
        orgId={orgId}
        member={managing}
        onChanged={() => {
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
