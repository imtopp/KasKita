"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { orgDuesLabelSchema } from "@/lib/types";
import type { OrgNameForm } from "@/lib/types";

export function OrgDuesLabelForm({
  orgId,
  currentLabel,
}: {
  orgId: string;
  currentLabel: string;
}) {
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrgNameForm>({
    defaultValues: { name: currentLabel },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setNotice(null);

    const parsed = orgDuesLabelSchema.safeParse({ label: values.name });
    if (!parsed.success) {
      setError("name", { message: parsed.error.issues[0].message });
      return;
    }

    if (parsed.data.label === currentLabel) {
      setNotice("Label masih sama dengan sebelumnya.");
      return;
    }

    const { error } = await supabase
      .from("organizations")
      .update({ dues_entity_label: parsed.data.label })
      .eq("id", orgId);

    if (error) {
      setServerError(
        /row-level security|permission denied/i.test(error.message)
          ? "Kamu tidak punya izin mengubah label ini."
          : "Gagal mengubah label. Coba lagi.",
      );
      return;
    }

    setNotice("Label berhasil diubah.");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverError && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}
      {notice && (
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          {notice}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="duesLabel">Label unit iuran</Label>
        <Input
          id="duesLabel"
          type="text"
          className="h-11"
          placeholder="Contoh: Warga, Rumah, Anggota, Karyawan, Siswa"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Nama yang tampil untuk unit pembayar iuran. Default: Warga.
        </p>
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full text-base sm:w-auto sm:px-6"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Menyimpan...
          </>
        ) : (
          "Simpan perubahan"
        )}
      </Button>
    </form>
  );
}