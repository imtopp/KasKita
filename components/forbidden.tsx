import Link from "next/link";

import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Forbidden({ fallbackHref }: { fallbackHref: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <ShieldAlert className="size-10 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-lg font-bold">Akses ditolak</h1>
        <p className="text-sm text-muted-foreground">
          Kamu bukan anggota organisasi ini.
        </p>
      </div>
      <Button
        render={<Link href={fallbackHref} />}
        className="h-11 w-full max-w-xs text-base"
      >
        Kembali ke organisasiku
      </Button>
    </main>
  );
}
