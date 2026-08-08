"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  categories: CategoryOption[];
  transaction: TransactionRow | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [serverError, setServerError] = useState<string | null>(null);

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
    }
  }, [open, transaction, reset]);

  const type = watch("type");
  const categoryId = watch("category_id");
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

    if (transaction) {
      const { error } = await supabase
        .from("transactions")
        .update({
          category_id: parsed.data.category_id,
          type: parsed.data.type,
          amount,
          transaction_date: parsed.data.transaction_date,
          description: parsed.data.description || null,
        })
        .eq("id", transaction.id);
      if (error) {
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
          created_by: user.id,
        });
      if (error) {
        setServerError(errorMessage(error));
        return;
      }
    }

    onOpenChange(false);
    router.refresh();
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
              value={categoryId || "__empty__"}
              onValueChange={(value: string | null) => {
                if (value && value !== "__empty__") {
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
            <Input
              id="txDate"
              type="date"
              className="h-11"
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
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
            >
              Batal
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 text-base"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
