"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

export function ReceiptViewDialog({
  open,
  onOpenChange,
  receiptUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptUrl: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="w-[min(calc(100%-2rem),28rem)] overflow-hidden p-0"
      >
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Foto bukti</DialogTitle>
        </DialogHeader>
        {receiptUrl ? <ReceiptImage key={receiptUrl} path={receiptUrl} /> : null}
      </DialogContent>
    </Dialog>
  );
}

// State fetch di-reset otomatis lewat `key` saat path berubah; tidak ada
// setState sinkron di dalam effect (aman aturan react-hooks/set-state-in-effect).
function ReceiptImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.storage
      .from("receipts")
      .createSignedUrl(path, 3600)
      .then(({ data, error: signError }) => {
        if (cancelled) return;
        if (signError || !data?.signedUrl) {
          setError("Gagal memuat foto bukti. Coba lagi.");
          return;
        }
        setUrl(data.signedUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat foto bukti. Coba lagi.");
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (error) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Memuat foto...
      </div>
    );
  }

  return (
    <div className="max-h-105 overflow-y-auto bg-muted/40 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL signed, bukan remote static */}
      <img
        src={url}
        alt="Foto bukti transaksi"
        className="h-auto w-full rounded-lg object-contain"
      />
    </div>
  );
}