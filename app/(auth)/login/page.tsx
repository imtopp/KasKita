"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginForm } from "@/lib/types";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  function safeNext(value: string | null): string {
    if (value && value.startsWith("/") && !value.startsWith("//")) {
      return value;
    }
    return "/";
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as "email" | "password", {
          message: issue.message,
        });
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      setServerError(getAuthErrorMessage(error));
      return;
    }

    const next = safeNext(searchParams.get("next"));
    setRedirecting(true);
    router.push(next);
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk ke KasKita</CardTitle>
        <CardDescription>Catat dan pantau kas organisasimu.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-4">
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
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
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4">
          <Button
            type="submit"
            disabled={isSubmitting || redirecting}
            className="h-11 w-full text-base"
          >
            {isSubmitting || redirecting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Masuk...
              </>
            ) : (
              "Masuk"
            )}
          </Button>
          <div className="flex flex-col gap-1 text-center text-sm text-muted-foreground">
            <Link
              href="/reset-password"
              className="text-primary underline-offset-4 hover:underline"
            >
              Lupa password?
            </Link>
            <span>
              Belum punya akun?{" "}
              <Link
                href="/register"
                className="text-primary underline-offset-4 hover:underline"
              >
                Daftar
              </Link>
            </span>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
