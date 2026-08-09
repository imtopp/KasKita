"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addExistingMemberSchema,
  createMemberSchema,
  type CreateMemberForm,
} from "@/lib/types";

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

type Created = {
  name: string;
  email: string;
  password?: string;
  existing?: boolean;
};

export function CreateMemberDialog({
  open,
  onOpenChange,
  orgId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onCreated: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [emailExists, setEmailExists] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateMemberForm>({
    defaultValues: { name: "", email: "", password: "", role: "viewer" },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      setCreated(null);
      setEmailExists(false);
      setMode("create");
      reset({ name: "", email: "", password: "", role: "viewer" });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setEmailExists(false);

    if (mode === "existing") {
      const parsed = addExistingMemberSchema.safeParse({
        email: values.email,
        role: values.role,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          setError(issue.path[0] as "email" | "role", {
            message: issue.message,
          });
        }
        return;
      }

      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          existing: true,
          email: parsed.data.email,
          role: parsed.data.role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(data.error ?? "Gagal menambahkan anggota.");
        return;
      }

      setCreated({
        name: parsed.data.email,
        email: parsed.data.email,
        existing: true,
      });
      onCreated();
      return;
    }

    const parsed = createMemberSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(
          issue.path[0] as "name" | "email" | "password" | "role",
          { message: issue.message },
        );
      }
      return;
    }

    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, ...parsed.data }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 409 && data.emailExists) {
        setEmailExists(true);
      }
      setServerError(data.error ?? "Gagal membuat akun anggota.");
      return;
    }

    setCreated({ name: data.name, email: data.email, password: data.password });
    onCreated();
  });

  if (created) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {created.existing ? "Anggota ditambahkan" : "Akun anggota dibuat"}
            </DialogTitle>
            <DialogDescription>
              {created.existing ? (
                <>
                  {created.email} sudah ditambahkan sebagai anggota organisasi
                  ini. Dia bisa langsung login dengan akunnya yang sudah ada.
                </>
              ) : (
                <>
                  Akun untuk {created.name} ({created.email}) berhasil dibuat.
                  Sampaikan password sementara berikut dengan aman (chat/WA tatap
                  muka), jangan lewat email.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {!created.existing && (
            <div className="rounded-xl border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Password sementara
              </p>
              <p className="mt-1 break-all font-mono text-lg font-bold">
                {created.password}
              </p>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-11" />}>
              Tutup
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "existing"
              ? "Tambah anggota existing"
              : "Daftarkan anggota manual"}
          </DialogTitle>
          <DialogDescription>
            {mode === "existing"
              ? "Email ini sudah punya akun KasKita. Tambahkan langsung sebagai anggota organisasi ini."
              : "Buat akun langsung tanpa mengirim email. Anggota akan diminta ganti password saat login pertama."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          {emailExists && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full text-base"
              onClick={() => {
                setMode("existing");
                setEmailExists(false);
                setServerError(null);
              }}
            >
              Email sudah terdaftar — tambahkan sebagai anggota
            </Button>
          )}
          {mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="memName">Nama lengkap</Label>
              <Input
                id="memName"
                type="text"
                placeholder="Contoh: Budi Santoso"
                className="h-11"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="memEmail">Email</Label>
            <Input
              id="memEmail"
              type="email"
              inputMode="email"
              placeholder="nama@contoh.com"
              className="h-11"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          {mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="memPassword">Password sementara</Label>
              <div className="flex gap-2">
                <Input
                  id="memPassword"
                  type="text"
                  className="h-11 min-w-0 flex-1 font-mono"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 px-4"
                  onClick={() =>
                    setValue("password", randomPassword(), {
                      shouldValidate: true,
                    })
                  }
                >
                  Acak
                </Button>
              </div>
              {errors.password ? (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Minimal 8 karakter.
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>Peran</Label>
            <Select
              value={watch("role")}
              onValueChange={(value: string | null) => {
                if (value)
                  setValue(
                    "role",
                    value as "co_owner" | "treasurer" | "viewer",
                  );
              }}
            >
              <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="co_owner">Co-owner</SelectItem>
                <SelectItem value="treasurer">Bendahara</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "create" && (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm text-primary"
              onClick={() => {
                setMode("existing");
                setServerError(null);
                setEmailExists(false);
              }}
            >
              Email sudah punya akun? Tambahkan sebagai anggota existing
            </Button>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-11" />}>
              Batal
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 text-base"
            >
              {isSubmitting && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {isSubmitting
                ? mode === "existing"
                  ? "Menambahkan..."
                  : "Membuat..."
                : mode === "existing"
                  ? "Tambahkan"
                  : "Buat akun"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
