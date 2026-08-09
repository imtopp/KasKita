"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MemberRow } from "@/lib/types";
import {
  changeMemberEmailSchema,
  resetMemberPasswordSchema,
  type ChangeMemberEmailForm,
  type ResetMemberPasswordForm,
} from "@/lib/types";

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

const ROLE_LABELS: Record<MemberRow["role"], string> = {
  owner: "Owner",
  co_owner: "Co-owner",
  treasurer: "Bendahara",
  viewer: "Viewer",
};

export function MemberManageDialog({
  open,
  onOpenChange,
  orgId,
  member,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  member: MemberRow | null;
  onChanged: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyPassword, setBusyPassword] = useState(false);
  const [busyActive, setBusyActive] = useState(false);
  const [confirmActive, setConfirmActive] = useState(false);
  const [busySessions, setBusySessions] = useState(false);
  const [confirmSessions, setConfirmSessions] = useState(false);
  const prevOpen = useRef(false);

  const emailForm = useForm<ChangeMemberEmailForm>({
    defaultValues: { userId: "", email: "" },
  });
  const passwordForm = useForm<ResetMemberPasswordForm>({
    defaultValues: { userId: "", password: "" },
  });

  useEffect(() => {
    const opening = open && !prevOpen.current;
    prevOpen.current = open;
    if (opening && member) {
      setNotice(null);
      setError(null);
      setTempPassword(null);
      setConfirmActive(false);
      setConfirmSessions(false);
      emailForm.reset({ userId: member.user_id, email: member.email });
      passwordForm.reset({ userId: member.user_id, password: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member]);

  async function submitEmail(values: ChangeMemberEmailForm) {
    if (!member || busyEmail) return;
    setBusyEmail(true);
    setError(null);
    setNotice(null);
    const parsed = changeMemberEmailSchema.safeParse(values);
    if (!parsed.success) {
      setBusyEmail(false);
      for (const issue of parsed.error.issues) {
        emailForm.setError("email", { message: issue.message });
      }
      return;
    }
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, changeEmail: true, ...parsed.data }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyEmail(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal mengganti email.");
      return;
    }
    setNotice(`Email diubah menjadi ${parsed.data.email}.`);
    onChanged();
  }

  async function submitPassword(values: ResetMemberPasswordForm) {
    if (!member || busyPassword) return;
    setBusyPassword(true);
    setError(null);
    setNotice(null);
    setTempPassword(null);
    const parsed = resetMemberPasswordSchema.safeParse(values);
    if (!parsed.success) {
      setBusyPassword(false);
      for (const issue of parsed.error.issues) {
        passwordForm.setError("password", { message: issue.message });
      }
      return;
    }
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, resetPassword: true, ...parsed.data }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyPassword(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal mengatur ulang password.");
      return;
    }
    setTempPassword(parsed.data.password);
    setNotice("Password sementara baru tersimpan.");
    onChanged();
  }

  async function toggleActive() {
    if (!member || busyActive) return;
    setBusyActive(true);
    setError(null);
    setNotice(null);
    const active = !member.banned_until;
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        setActive: true,
        userId: member.user_id,
        active,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyActive(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal mengubah status akun.");
      return;
    }
    setConfirmActive(false);
    setNotice(
      active
        ? `Akun ${member.name ?? member.email} dinonaktifkan.`
        : `Akun ${member.name ?? member.email} diaktifkan kembali.`,
    );
    onChanged();
  }

  async function revokeSessions() {
    if (!member || busySessions) return;
    setBusySessions(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId,
        revokeSessions: true,
        userId: member.user_id,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusySessions(false);
    if (!res.ok) {
      setError(data.error ?? "Gagal memutuskan sesi.");
      return;
    }
    setConfirmSessions(false);
    setNotice(
      `Semua sesi ${member.name ?? member.email} diputus. Dia harus login ulang.`,
    );
  }

  if (!member) return null;

  const active = !member.banned_until;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola anggota</DialogTitle>
          <DialogDescription>
            {member.name ?? member.email} · {member.email} ·{" "}
            {ROLE_LABELS[member.role]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {notice && !tempPassword && (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              {notice}
            </div>
          )}

          <div className="space-y-3 rounded-xl border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="size-4" aria-hidden />
              Ganti email
            </p>
            <form
              onSubmit={emailForm.handleSubmit(submitEmail)}
              noValidate
              className="space-y-3"
            >
              <div className="space-y-2">
                <Label htmlFor="manageEmail">Email baru</Label>
                <Input
                  id="manageEmail"
                  type="email"
                  inputMode="email"
                  className="h-11"
                  aria-invalid={!!emailForm.formState.errors.email}
                  {...emailForm.register("email")}
                />
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={busyEmail}
                className="h-11 w-full text-base"
              >
                {busyEmail && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {busyEmail ? "Menyimpan..." : "Simpan email"}
              </Button>
            </form>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="size-4" aria-hidden />
              Atur ulang password
            </p>
            <form
              onSubmit={passwordForm.handleSubmit(submitPassword)}
              noValidate
              className="space-y-3"
            >
              <div className="space-y-2">
                <Label htmlFor="managePassword">
                  Password sementara baru
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="managePassword"
                    type="text"
                    className="h-11 font-mono"
                    aria-invalid={!!passwordForm.formState.errors.password}
                    {...passwordForm.register("password")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 px-4"
                    onClick={() =>
                      passwordForm.setValue(
                        "password",
                        randomPassword(),
                        { shouldValidate: true },
                      )
                    }
                  >
                    Acak
                  </Button>
                </div>
                {passwordForm.formState.errors.password ? (
                  <p className="text-sm text-destructive">
                    {passwordForm.formState.errors.password.message}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Minimal 8 karakter. Anggota diminta ganti password saat
                    login berikutnya.
                  </p>
                )}
              </div>
              {tempPassword && (
                <div className="rounded-xl border p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Password sementara baru
                  </p>
                  <p className="mt-1 break-all font-mono text-lg font-bold">
                    {tempPassword}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sampaikan dengan aman (chat/WA tatap muka), jangan lewat
                    email.
                  </p>
                </div>
              )}
              <Button
                type="submit"
                disabled={busyPassword}
                className="h-11 w-full text-base"
              >
                {busyPassword && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {busyPassword ? "Menyimpan..." : "Simpan password baru"}
              </Button>
            </form>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              {active ? (
                <ShieldCheck className="size-4" aria-hidden />
              ) : (
                <ShieldX className="size-4" aria-hidden />
              )}
              Status akun
            </p>
            {confirmActive ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {active
                    ? `Nonaktifkan akun ${member.name ?? member.email}? Dia tidak bisa login sampai diaktifkan kembali.`
                    : `Aktifkan kembali akun ${member.name ?? member.email}?`}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1"
                    disabled={busyActive}
                    onClick={() => setConfirmActive(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    variant={active ? "destructive" : "default"}
                    className="h-11 flex-1"
                    disabled={busyActive}
                    onClick={toggleActive}
                  >
                    {busyActive && (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    )}
                    {busyActive
                      ? "Menyimpan..."
                      : active
                        ? "Nonaktifkan"
                        : "Aktifkan"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {active ? "Aktif" : "Nonaktif"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {active
                      ? "Anggota bisa login seperti biasa."
                      : "Anggota tidak bisa login sampai diaktifkan kembali."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={active ? "destructive" : "outline"}
                  className="h-11 shrink-0"
                  onClick={() => {
                    setConfirmActive(true);
                    setError(null);
                  }}
                >
                  {active ? "Nonaktifkan akun" : "Aktifkan kembali"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <LogOut className="size-4" aria-hidden />
              Putuskan semua sesi
            </p>
            {confirmSessions ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Keluarkan {member.name ?? member.email} dari semua perangkat
                  (HP, laptop, dll)? Dia harus login ulang. Cocok untuk
                  prosedur akun kena hack — kombinasikan dengan atur ulang
                  password.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1"
                    disabled={busySessions}
                    onClick={() => setConfirmSessions(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-11 flex-1"
                    disabled={busySessions}
                    onClick={revokeSessions}
                  >
                    {busySessions && (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden
                      />
                    )}
                    {busySessions
                      ? "Memutuskan..."
                      : "Putuskan semua sesi"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Keluarkan dari semua perangkat. Refresh token langsung
                    tidak berlaku; access token lama kedaluwarsa otomatis
                    (maks. ±1 jam).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={() => {
                    setConfirmSessions(true);
                    setError(null);
                  }}
                >
                  Putuskan sesi
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogClose
          render={
            <Button type="button" variant="outline" className="h-11 w-full" />
          }
        >
          Tutup
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
