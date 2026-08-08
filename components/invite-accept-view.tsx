"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

type Preview = {
  organizationName: string;
  organizationSlug: string;
  role: "treasurer" | "viewer";
};

export function InviteAcceptView({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Undangan tidak ditemukan.");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPreview(data.invitation);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    if (!token || accepting) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Gagal menerima undangan.");
      router.push(`/org/${data.organizationSlug}/dashboard`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setAccepting(false);
    }
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Undangan organisasi</CardTitle>
          <CardDescription>
            Link undangan tidak valid. Minta owner untuk mengirim undangan
            ulang.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button
            variant="outline"
            className="h-11 w-full text-base"
            render={<Link href="/" />}
          >
            Ke dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Memuat undangan...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Undangan organisasi</CardTitle>
        <CardDescription>
          {preview
            ? `${preview.organizationName} mengundangmu sebagai ${
                preview.role === "treasurer" ? "bendahara" : "anggota (viewer)"
              }.`
            : "Kamu sudah masuk, tetapi undangan ini tidak bisa diproses."}
        </CardDescription>
      </CardHeader>
      {error && (
        <CardContent>
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        </CardContent>
      )}
      <CardFooter className="flex-col items-stretch gap-3">
        {preview && !error && (
          <Button
            onClick={accept}
            disabled={accepting}
            className="h-11 w-full text-base"
          >
            {accepting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Memproses...
              </>
            ) : (
              "Terima undangan"
            )}
          </Button>
        )}
        <Button
          variant="outline"
          className="h-11 w-full text-base"
          render={
            <a
              href={
                preview
                  ? `/org/${preview.organizationSlug}/dashboard`
                  : "/"
              }
            />
          }
        >
          Kembali ke dashboard
        </Button>
      </CardFooter>
    </Card>
  );
}
