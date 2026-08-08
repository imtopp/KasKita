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
  categorySchema,
  type CategoryForm,
  type CategoryRow,
} from "@/lib/types";

function errorMessage(error: { message: string }): string {
  if (/row-level security|permission denied/i.test(error.message)) {
    return "Kamu tidak punya izin untuk mengubah kategori.";
  }
  return "Gagal menyimpan kategori. Coba lagi.";
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  orgId,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  category: CategoryRow | null;
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
  } = useForm<CategoryForm>({
    defaultValues: {
      name: "",
      type: "expense",
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      reset(
        category
          ? { name: category.name, type: category.type }
          : { name: "", type: "expense" },
      );
    }
  }, [open, category, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const parsed = categorySchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path[0] as "name" | "type", {
          message: issue.message,
        });
      }
      return;
    }

    if (category) {
      const { error } = await supabase
        .from("categories")
        .update({
          name: parsed.data.name,
          type: parsed.data.type,
        })
        .eq("id", category.id);
      if (error) {
        setServerError(errorMessage(error));
        return;
      }
    } else {
      const { error } = await supabase
        .from("categories")
        .insert({
          organization_id: orgId,
          name: parsed.data.name,
          type: parsed.data.type,
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
            {category ? "Edit kategori" : "Tambah kategori"}
          </DialogTitle>
          <DialogDescription>
            {category
              ? "Ubah nama atau jenis kategori."
              : "Buat kategori kustom untuk transaksi organisasi."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="catName">Nama kategori</Label>
            <Input
              id="catName"
              type="text"
              placeholder="Contoh: Listrik, Sumbangan, Renovasi"
              className="h-11"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Jenis</Label>
            <Select
              value={watch("type")}
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
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-11" />}>
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
