"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/date-input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  compressReceiptImage,
  deleteReceipt,
  receiptFileError,
  receiptPath,
  uploadReceiptError,
} from "@/lib/receipts";
import { createClient } from "@/lib/supabase/client";
import {
  transactionSchema,
  type CategoryOption,
  type TransactionForm,
  type TransactionRow,
} from "@/lib/types";
import { todayISO } from "@/lib/utils";

function errorMessage(error: { message: string }): string {
  if (/row-level security|permission denied/i.test(error.message)) {
    return "Kamu tidak punya izin untuk mengubah transaksi.";
  }
  return "Gagal menyimpan transaksi. Coba lagi.";
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  orgId,
  categories,
  transaction,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  categories: CategoryOption[];
  transaction: TransactionRow | null;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);

  // State foto bukti.
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [existingPreview, setExistingPreview] = useState<string | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const setPreview = useCallback((url: string | null) => {
    if (previewUrlRef.current && previewUrlRef.current !== url) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = url;
    setReceiptPreview(url);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TransactionForm>({
    defaultValues: {
      type: "expense",
      category_id: "",
      amount: "",
      transaction_date: todayISO(),
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      setReceiptError(null);
      setReceiptFile(null);
      setRemoveReceipt(false);
      setExistingPreview(null);
      setPreview(null);
      reset(
        transaction
          ? {
              type: transaction.type,
              category_id: transaction.category_id ?? "",
              amount: String(transaction.amount),
              transaction_date: transaction.transaction_date,
              description: transaction.description ?? "",
            }
          : {
              type: "expense",
              category_id: "",
              amount: "",
              transaction_date: todayISO(),
              description: "",
            },
      );

      if (transaction?.receipt_url) {
        let cancelled = false;
        const client = createClient();
        client.storage
          .from("receipts")
          .createSignedUrl(transaction.receipt_url, 3600)
          .then(({ data }) => {
            if (!cancelled && data?.signedUrl) {
              setExistingPreview(data.signedUrl);
            }
          })
          .catch(() => {});
        return () => {
          cancelled = true;
        };
      }
    }
  }, [open, transaction, reset, setPreview]);

  const type = watch("type");
  const categoryId = watch("category_id");
  const transactionDate = watch("transaction_date");
  const typeCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!categoryId) return;
    const valid = categories.some(
      (c) => c.id === categoryId && c.type === type,
    );
    if (!valid) {
      setValue("category_id", "", { shouldValidate: true });
    }
  }, [categoryId, type, categories, setValue]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = receiptFileError(file);
    if (validationError) {
      setReceiptError(validationError);
      return;
    }
    setReceiptError(null);
    try {
      const compressed = await compressReceiptImage(file);
      setPreview(URL.createObjectURL(compressed));
      setReceiptFile(compressed);
    } catch (error) {
      setReceiptError(
        error instanceof Error ? error.message : "Gagal memuat foto.",
      );
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const parsed = transactionSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(
          issue.path[0] as
            | "type"
            | "category_id"
            | "amount"
            | "transaction_date"
            | "description",
          { message: issue.message },
        );
      }
      return;
    }

    const amount = Number(parsed.data.amount);
    if (!(amount > 0)) {
      setError("amount", { message: "Nominal harus lebih dari 0" });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setServerError("Sesi berakhir. Silakan masuk kembali.");
      return;
    }

    const existingReceipt = transaction?.receipt_url ?? null;
    let receiptUrl: string | null = existingReceipt;
    let uploadedPath: string | null = null;
    let oldToDelete: string | null = null;

    if (receiptFile) {
      uploadedPath = receiptPath(orgId);
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(uploadedPath, receiptFile, {
          contentType: receiptFile.type || "image/jpeg",
          upsert: false,
        });
      if (uploadError) {
        setServerError(uploadReceiptError(uploadError));
        return;
      }
      receiptUrl = uploadedPath;
      oldToDelete = existingReceipt;
    } else if (removeReceipt && existingReceipt) {
      receiptUrl = null;
      oldToDelete = existingReceipt;
    }

    if (transaction) {
      const { error } = await supabase
        .from("transactions")
        .update({
          category_id: parsed.data.category_id,
          type: parsed.data.type,
          amount,
          transaction_date: parsed.data.transaction_date,
          description: parsed.data.description || null,
          receipt_url: receiptUrl,
        })
        .eq("id", transaction.id);
      if (error) {
        if (uploadedPath) void deleteReceipt(supabase, uploadedPath);
        setServerError(errorMessage(error));
        return;
      }
    } else {
      const { error } = await supabase
        .from("transactions")
        .insert({
          organization_id: orgId,
          category_id: parsed.data.category_id,
          type: parsed.data.type,
          amount,
          transaction_date: parsed.data.transaction_date,
          description: parsed.data.description || null,
          receipt_url: receiptUrl,
          created_by: user.id,
        });
      if (error) {
        if (uploadedPath) void deleteReceipt(supabase, uploadedPath);
        setServerError(errorMessage(error));
        return;
      }
    }

    // File lama hanya dihapus SETELAH update/insert sukses — kalau gagal,
    // bukti lama tetap aman.
    if (oldToDelete && oldToDelete !== receiptUrl) {
      void deleteReceipt(supabase, oldToDelete);
    }

    onOpenChange(false);
    // Refresh ditunda & di-gate oleh scheduleRefresh di TransactionsView agar
    // tidak jatuh di jendela exit+hold popup dialog (menyebabkan popup
    // "muncul lagi" sepersekian detik setelah fadeout — kambuh yang hanya
    // muncul dengan latensi jaringan tinggi / throttling).
    onSaved();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Edit transaksi" : "Tambah transaksi"}
          </DialogTitle>
          <DialogDescription>
            {transaction
              ? "Ubah detail transaksi."
              : "Catat pemasukan atau pengeluaran kas."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Jenis</Label>
              <Select
                value={type}
                onValueChange={(value: string | null) => {
                  if (value) setValue("type", value as "income" | "expense");
                }}
              >
                <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Pemasukan</SelectItem>
                  <SelectItem value="expense">Pengeluaran</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nominal (Rp)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                className="h-11"
                aria-invalid={!!errors.amount}
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">
                  {errors.amount.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={categoryId}
              onValueChange={(value: string | null) => {
                if (value) {
                  setValue("category_id", value, { shouldValidate: true });
                }
              }}
            >
              <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {typeCategories.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Belum ada kategori {type === "income" ? "pemasukan" : "pengeluaran"}.
                  </div>
                )}
                {typeCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_id && (
              <p className="text-sm text-destructive">
                {errors.category_id.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="txDate">Tanggal</Label>
            <DateInput
              id="txDate"
              value={transactionDate}
              aria-invalid={!!errors.transaction_date}
              {...register("transaction_date")}
            />
            {errors.transaction_date && (
              <p className="text-sm text-destructive">
                {errors.transaction_date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="txDesc">Deskripsi (opsional)</Label>
            <Input
              id="txDesc"
              type="text"
              placeholder="Contoh: iuran bulan Juli"
              className="h-11"
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Foto bukti (opsional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {receiptPreview ? (
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau file lokal (blob URL) */}
                <img
                  src={receiptPreview}
                  alt="Pratinjau foto bukti"
                  className="h-16 w-16 rounded-lg border object-cover"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-3 text-sm"
                  onClick={() => {
                    setReceiptFile(null);
                    setPreview(null);
                  }}
                >
                  <X aria-hidden className="size-4" />
                  Hapus pilihan
                </Button>
              </div>
            ) : existingPreview && !removeReceipt ? (
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL signed hasil createSignedUrl */}
                <img
                  src={existingPreview}
                  alt="Foto bukti saat ini"
                  className="h-16 w-16 rounded-lg border object-cover"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-3 text-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus aria-hidden className="size-4" />
                    Ganti
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-3 text-sm text-destructive"
                    onClick={() => setRemoveReceipt(true)}
                  >
                    Hapus foto
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus aria-hidden className="size-4" />
                  Pilih foto
                </Button>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  JPG/PNG/HEIC, otomatis dikompres, maks 5 MB.
                </p>
              </div>
            )}
            {removeReceipt && existingPreview && (
              <p className="text-xs text-muted-foreground">
                Foto lama akan dihapus saat kamu menyimpan.
              </p>
            )}
            {receiptError && (
              <p className="text-sm text-destructive">{receiptError}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" className="h-11" />}
            >
              Batal
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 text-base"
            >
              {isSubmitting && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}