"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  createOrganizationSchema,
  type CreateOrganizationForm,
} from "@/lib/types";
import { slugify } from "@/lib/utils";

export function CreateOrganizationForm() {
  const router = useRouter();
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const slugManualEdit = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationForm>({
    defaultValues: { name: "", slug: "" },
  });

  const name = watch("name");

  useEffect(() => {
    if (!slugManualEdit.current) {
      setValue("slug", slugify(name), { shouldValidate: false });
    }
  }, [name, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const parsed = createOrganizationSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as "name" | "slug", {
          message: issue.message,
        });
      }
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setServerError("Sesi berakhir. Silakan masuk kembali.");
      return;
    }

    const { error } = await supabase.from("organizations").insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      created_by: user.id,
    });

    if (error) {
      if (/duplicate key/i.test(error.message) && /slug/i.test(error.message)) {
        setError("slug", {
          message: "Slug sudah dipakai. Coba yang lain.",
        });
      } else {
        setServerError("Gagal membuat organisasi. Coba lagi.");
      }
      return;
    }

    router.push(`/org/${parsed.data.slug}/dashboard`);
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
      <div className="space-y-2">
        <Label htmlFor="orgSlug">Alamat (slug)</Label>
        <Input
          id="orgSlug"
          type="text"
          className="h-11"
          placeholder="rt-05-sukamaju"
          aria-invalid={!!errors.slug}
          {...register("slug", {
            onChange: () => {
              slugManualEdit.current = true;
            },
          })}
        />
        {errors.slug ? (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Otomatis dibuat dari nama. Bisa diubah manual.
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full text-base"
      >
        {isSubmitting ? "Membuat..." : "Buat organisasi"}
      </Button>
    </form>
  );
}
