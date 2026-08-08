"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

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
  inviteMemberSchema,
  type InviteMemberForm,
} from "@/lib/types";

export function InviteMemberDialog({
  open,
  onOpenChange,
  orgId,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onInvited: (message: string) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberForm>({
    defaultValues: { email: "", role: "viewer" },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({ email: "", role: "viewer" });
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const parsed = inviteMemberSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as "email" | "role", {
          message: issue.message,
        });
      }
      return;
    }

    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, ...parsed.data }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setServerError(data.error ?? "Gagal mengirim undangan.");
      return;
    }

    onOpenChange(false);
    onInvited(data.message ?? "Undangan terkirim.");
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Undang anggota via email</DialogTitle>
          <DialogDescription>
            Anggota akan menerima email undangan dan masuk otomatis setelah
            menerima. Undangan berlaku 7 hari.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="invEmail">Email</Label>
            <Input
              id="invEmail"
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
          <div className="space-y-2">
            <Label>Peran</Label>
            <Select
              value={watch("role")}
              onValueChange={(value: string | null) => {
                if (value) setValue("role", value as "treasurer" | "viewer");
              }}
            >
              <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="treasurer">Bendahara</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-11" />}>
              Batal
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 text-base"
            >
              {isSubmitting ? "Mengirim..." : "Kirim undangan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
