"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema, type ResetPasswordForm } from "@/lib/types";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>();

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as "email", { message: issue.message });
      }
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      },
    );

    if (error) {
      setServerError("Terjadi kendala mengirim link reset. Coba lagi.");
      return;
    }

    setSent(true);
  });

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cek email kamu</CardTitle>
          <CardDescription>
            Kalau email terdaftar, link reset password sudah dikirim. Gunakan
            link tersebut untuk mengatur password baru.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="h-11 w-full text-base">
              Kembali ke masuk
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          Masukkan email untuk menerima link reset password.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4 pb-2">
          {serverError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className="h-11"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full text-base"
          >
            {isSubmitting && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {isSubmitting ? "Mengirim..." : "Kirim link reset"}
          </Button>
          <Link
            href="/login"
            className="text-center text-sm text-primary underline-offset-4 hover:underline"
          >
            Kembali ke masuk
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
