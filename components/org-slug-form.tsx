"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { orgSlugSchema, type OrgSlugForm } from "@/lib/types";

export function OrgSlugForm({
  orgId,
  currentSlug,
}: {
  orgId: string;
  currentSlug: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrgSlugForm>({
    defaultValues: { slug: currentSlug },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const parsed = orgSlugSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError("slug", { message: issue.message });
      }
      return;
    }

    if (parsed.data.slug === currentSlug) {
      setServerError("Alamat (slug) masih sama dengan sebelumnya.");
      return;
    }

    const { data: available, error: rpcError } = await supabase.rpc<
      "is_slug_available",
      { slug: string }
    >("is_slug_available", { slug: parsed.data.slug });

    if (rpcError) {
      setServerError("Gagal memeriksa slug. Coba lagi.");
      return;
    }

    if (available === false) {
      setError("slug", {
        message: "Slug sudah dipakai. Coba yang lain.",
      });
      return;
    }

    const { error } = await supabase
      .from("organizations")
      .update({ slug: parsed.data.slug })
      .eq("id", orgId);

    if (error) {
      if (/duplicate key/i.test(error.message) && /slug/i.test(error.message)) {
        setError("slug", {
          message: "Slug sudah dipakai. Coba yang lain.",
        });
      } else if (/row-level security|permission denied/i.test(error.message)) {
        setServerError("Kamu tidak punya izin mengubah alamat organisasi.");
      } else {
        setServerError("Gagal mengubah alamat. Coba lagi.");
      }
      return;
    }

    setRedirecting(true);
    router.replace(`/org/${parsed.data.slug}/settings`);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverError && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="orgSlug">Alamat (slug)</Label>
        <Input
          id="orgSlug"
          type="text"
          className="h-11"
          placeholder="rt-05-sukamaju"
          autoComplete="off"
          aria-invalid={!!errors.slug}
          {...register("slug")}
        />
        {errors.slug ? (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Alamat URL organisasi. Berubah berarti semua tautan lama ikut
            berubah.
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={isSubmitting || redirecting}
        className="h-11 w-full text-base sm:w-auto sm:px-6"
      >
        {isSubmitting || redirecting ? (
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
