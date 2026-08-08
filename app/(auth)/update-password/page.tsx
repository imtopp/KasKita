"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  updatePasswordSchema,
  type UpdatePasswordForm,
} from "@/lib/types";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordForm>();

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const parsed = updatePasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as "password" | "confirmPassword", {
          message: issue.message,
        });
      }
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      setServerError("Gagal mengubah password. Coba lagi.");
      return;
    }

    router.push("/");
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atur password baru</CardTitle>
        <CardDescription>
          Masukkan password baru untuk akun kamu.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Password baru</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              className="h-11"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Konfirmasi password baru</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="h-11"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </CardContent>
        <div className="px-(--card-spacing) pb-(--card-spacing)">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full text-base"
          >
            {isSubmitting ? "Menyimpan..." : "Simpan password baru"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
