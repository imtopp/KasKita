"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { orgNameSchema, type OrgNameForm } from "@/lib/types";

export function OrgNameForm({
  orgId,
  currentName,
}: {
  orgId: string;
  currentName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrgNameForm>({
    defaultValues: { name: currentName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setNotice(null);

    const parsed = orgNameSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as "name", { message: issue.message });
      }
      return;
    }

    if (parsed.data.name === currentName) {
      setNotice("Nama masih sama dengan sebelumnya.");
      return;
    }

    const { error } = await supabase
      .from("organizations")
      .update({ name: parsed.data.name })
      .eq("id", orgId);

    if (error) {
      setServerError(
        /row-level security|permission denied/i.test(error.message)
          ? "Kamu tidak punya izin mengubah nama organisasi."
          : "Gagal mengubah nama. Coba lagi.",
      );
      return;
    }

    setNotice("Nama organisasi berhasil diubah.");
    router.refresh();
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
        <Label htmlFor="orgName">Nama organisasi</Label>
        <Input
          id="orgName"
          type="text"
          autoComplete="organization"
          className="h-11"
          placeholder="Contoh: RT 05 Sukamaju"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
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
