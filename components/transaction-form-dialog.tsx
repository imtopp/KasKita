"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
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
  duesFieldsSchema,
  transactionSchema,
  type CategoryOption,
  type PayerRow,
  type TransactionForm,
  type TransactionRow,
} from "@/lib/types";
import { MONTH_NAMES, todayISO } from "@/lib/utils";

const PERIOD_YEAR_BACK = 5;
const PERIOD_YEAR_FORWARD = 2;
// Batas aman pecahan multi-bulan (52 bulan = >4 tahun; nominal yang lebih besar
// dari itu diminta dibagi manual agar tidak membuat ratusan transaksi sekali jalan).
const MAX_DUES_MONTHS = 48;

function errorMessage(error: { message: string }): string {
  if (/row-level security|permission denied/i.test(error.message)) {
    return "Kamu tidak punya izin untuk mengubah transaksi.";
  }
  return "Gagal menyimpan transaksi. Coba lagi.";
}

function addMonths(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

// Bagaimana nominal total dipecah (dues_default per bulan).
function splitDues(total: number, perMonth: number): {
  full: number;
  rem: number;
} {
  const full = Math.floor(total / perMonth);
  return { full, rem: total % perMonth };
}

// Jadwal penempatan nominal total ke bulan-bulan iuran (dari periode awal):
// bulan yang sudah lunas (paid >= perMonth) dilewati, bulan yang baru cicil
// (0 < paid < perMonth) DIDAHULUKAN untuk ditutup dulu, sisanya baru jatuh ke
// bulan kosong berikutnya. Contoh: Agustus lunas + September cicil 10rb, bayar
// 70rb "untuk Juni" → Juni 50rb lunas, sisa 20rb menutup September (jadi 30rb),
// bukan langsung ke Oktober. Mengembalikan null bila keburu tak beres dalam
// jangka wajar (guard anti loop tak berujung di data yang aneh).
function duesSchedule(
  period: string,
  total: number,
  perMonth: number,
  paidByMonth: Readonly<Record<string, number>>,
): Array<{ period: string; amount: number }> | null {
  const out: Array<{ period: string; amount: number }> = [];
  const paidMap = { ...paidByMonth };
  let remaining = total;
  let current = period;
  let skipped = 0;
  while (remaining > 0) {
    if (skipped > 480) return null;
    const key = current.slice(0, 7);
    const capacity = perMonth - (paidMap[key] ?? 0);
    if (capacity <= 0) {
      skipped += 1;
    } else {
      const amount = Math.min(remaining, capacity);
      out.push({ period: current, amount });
      paidMap[key] = (paidMap[key] ?? 0) + amount;
      remaining -= amount;
      skipped = 0;
    }
    current = addMonths(current, 1);
  }
  return out;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  orgId,
  categories,
  payers,
  entityLabel,
  duesHref,
  transaction,
  paidPeriodsByPayer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  categories: CategoryOption[];
  payers: PayerRow[];
  entityLabel: string;
  duesHref: string;
  transaction: TransactionRow | null;
  paidPeriodsByPayer: Record<string, Record<string, number>>;
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
    getValues,
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
      dues_payer_id: "",
      dues_period: "",
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
              dues_payer_id: transaction.dues_payer_id ?? "",
              dues_period: transaction.dues_period
                ? transaction.dues_period.slice(0, 7)
                : "",
            }
          : {
              type: "expense",
              category_id: "",
              amount: "",
              transaction_date: todayISO(),
              description: "",
              dues_payer_id: "",
              dues_period: "",
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
  const duesPayerId = watch("dues_payer_id");
  const duesPeriod = watch("dues_period");
  const amountWatched = watch("amount");
  const typeCategories = categories.filter((c) => c.type === type);
  const selectedCategory =
    categories.find((c) => c.id === categoryId && c.type === type) ?? null;
  const isDues = !!selectedCategory?.is_dues;
  const duesDefault = selectedCategory?.dues_default_amount ?? null;

  // Kolom DB menyimpan dates_period sebagai date (ISO penuh); form memakai
  // "YYYY-MM" (bulan boleh belum dipilih => "YYYY-" saja).
  const periodValue = duesPeriod ?? "";
  const periodYear =
    periodValue.length >= 4 ? Number(periodValue.slice(0, 4)) : null;
  const periodMonth = /^\d{4}-\d{2}/.test(periodValue)
    ? Number(periodValue.slice(5, 7))
    : null;

  // Ada berapa bulan & sisa dari nominal yang diterima, kalau standar di-set.
  const amountNum = Number(amountWatched || 0);
  const plan =
    isDues && duesDefault && amountNum > 0
      ? splitDues(amountNum, duesDefault)
      : null;
  const planCount =
    plan && plan.rem > 0 ? plan.full + 1 : plan?.full ?? (isDues ? 1 : 0);

  // Jumlah yang sudah dibayar per bulan untuk payer terpilih (transaksi baru
  // saja). Kunci "YYYY-MM" → total iuran yang sudah tercatat bulan itu.
  const paidThisPayer: Record<string, number> =
    !transaction && duesPayerId
      ? (paidPeriodsByPayer[duesPayerId] ?? {})
      : {};

  // Bulan tercatat lunas bila nominal yang masuk sudah >= standar bulan.
  function isMonthLunas(month: number): boolean {
    if (periodYear === null || duesDefault === null) return false;
    const paid = paidThisPayer[`${periodYear}-${String(month).padStart(2, "0")}`];
    return paid !== undefined && paid >= duesDefault;
  }

  // Pratinjau berapa transaksi yang bakal dibuat (skid masa lunas/tutup cicil).
  const schedulePreview =
    isDues && duesDefault && amountNum > 0 && periodYear !== null && periodMonth !== null
      ? (duesSchedule(
          `${periodValue}-01`,
          amountNum,
          duesDefault,
          paidThisPayer,
        ) ?? null)
      : null;
  const dueCount = schedulePreview ? schedulePreview.length : planCount;

  useEffect(() => {
    if (!categoryId) return;
    const valid = categories.some(
      (c) => c.id === categoryId && c.type === type,
    );
    if (!valid) {
      setValue("category_id", "", { shouldValidate: true });
    }
  }, [categoryId, type, categories, setValue]);

  // Saat pilih kategori iuran, isi nominal dgn standar kalau belum terisi.
  useEffect(() => {
    if (!isDues || transaction || !duesDefault) return;
    const amount = getValues("amount");
    if (amount === "" || Number(amount) <= 0) {
      setValue("amount", String(duesDefault));
    }
  }, [isDues, transaction, duesDefault, getValues, setValue]);

  // Tahun otomatis = tahun ini saat pilih kategori iuran (transaksi baru);
  // bulan TIDAK di-autoselect, bendahara memilih sendiri.
  useEffect(() => {
    if (!isDues || transaction) return;
    if (!getValues("dues_period")) {
      setValue("dues_period", `${new Date().getFullYear()}-`, {
        shouldValidate: true,
      });
    }
  }, [isDues, transaction, getValues, setValue]);

  // Bulan yang SUDAH LUNAS untuk payer terpilih — kosongkan pilihan bulan agar
  // tidak dobel catat; bulan yang baru dicicil tetap boleh (bisa ditutup lagi).
  useEffect(() => {
    if (!isDues || transaction || !duesPayerId) return;
    const current = getValues("dues_period") ?? "";
    if (/^\d{4}-\d{2}$/.test(current)) {
      const paid = paidThisPayer[current];
      if (duesDefault !== null && paid !== undefined && paid >= duesDefault) {
        setValue("dues_period", `${current.slice(0, 4)}-`, {
          shouldValidate: true,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDues, transaction, duesPayerId, duesPeriod, duesDefault, getValues, setValue]);

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
    // Dipisah dari variabel `parsed` agar narrowing tetap berlaku di dalam
    // closure `baseRecord()` di bawah ini.
    const data = parsed.data;

    let duesPayerIdValue: string | null = null;
    let period: string | null = null;
    const amount = Number(data.amount);
    if (isDues) {
      duesPayerIdValue = data.dues_payer_id!;
      // DB menyimpan `dues_period` sebagai date ("YYYY-MM-DD"); form memakai
      // "YYYY-MM". Normalisasi agar validasi & logika periode selalu konsisten.
      const periodRaw = data.dues_period ?? "";
      period =
        periodRaw.length === 10 ? periodRaw.slice(0, 7) : periodRaw;
      const duesCheck = duesFieldsSchema.safeParse({
        dues_payer_id: duesPayerIdValue ?? "",
        dues_period: period,
      });
      if (!duesCheck.success) {
        setServerError(duesCheck.error.issues[0].message);
        return;
      }
      // Simpan kembali sebagai date hari-1 bulan ("YYYY-MM-DD").
      if (period.length === 7) {
        period = `${period}-01`;
      }
    }

    if (!(amount > 0)) {
      setError("amount", { message: "Nominal harus lebih dari 0" });
      return;
    }

    // Jumlah bulannya belum tentu sama dengan jumlah transaksi (bulan yang
    // masih cicil ikut ditutup dulu), jadi batas 48 bulan dicek dua kali:
    // pre-check kasar di sini + cek jumlah jadwal setelah schedule dibuat.
    const plan =
      isDues && duesDefault ? splitDues(amount, duesDefault) : null;
    const planCount = plan ? plan.full + (plan.rem > 0 ? 1 : 0) : 1;
    if (plan && planCount > MAX_DUES_MONTHS) {
      setServerError(
        `Nominal ${amount.toLocaleString("id-ID")} setara lebih dari ${MAX_DUES_MONTHS} bulan iuran. Bayar per bagian supaya catatan tetap mudah dibaca.`,
      );
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

    function baseRecord() {
      return {
        category_id: data.category_id,
        type: data.type,
        description: data.description || null,
        transaction_date: data.transaction_date,
        receipt_url: receiptUrl,
        dues_payer_id: duesPayerIdValue,
        dues_period: period,
      };
    }

    if (transaction) {
      const { error } = await supabase
        .from("transactions")
        .update({
          ...baseRecord(),
          amount,
        })
        .eq("id", transaction.id);
      if (error) {
        if (uploadedPath) void deleteReceipt(supabase, uploadedPath);
        setServerError(errorMessage(error));
        return;
      }
    } else if (plan && period && duesPayerIdValue) {
      const schedule = duesSchedule(
        period,
        amount,
        duesDefault!,
        paidThisPayer,
      );
      if (!schedule) {
        setServerError(
          "Terlalu banyak bulan yang sudah tercatat sehingga sisa iuran tak bisa ditempatkan dalam jangka wajar. Bayar per bagian.",
        );
        return;
      }
      if (schedule.length > MAX_DUES_MONTHS) {
        setServerError(
          `Nominal ${amount.toLocaleString("id-ID")} terbagi jadi ${schedule.length} bulan (bulan bertaburan cicil ikut ditutup). Bayar per bagian supaya catatan tetap mudah dibaca.`,
        );
        return;
      }
      const records: Array<Record<string, unknown>> = schedule.map((row) => ({
        organization_id: orgId,
        ...baseRecord(),
        dues_period: row.period,
        amount: row.amount,
        created_by: user.id,
      }));
      if (records.length > 0) {
        const { error } = await supabase.from("transactions").insert(records);
        if (error) {
          if (uploadedPath) void deleteReceipt(supabase, uploadedPath);
          setServerError(errorMessage(error));
          return;
        }
      }
    } else {
      const { error } = await supabase.from("transactions").insert({
        organization_id: orgId,
        ...baseRecord(),
        amount,
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
    // tidak jatuh di jendela exit+hold popup dialog.
    onSaved();
  });

  const currentYear = new Date().getFullYear();
  const periodYears = Array.from(
    { length: PERIOD_YEAR_BACK + PERIOD_YEAR_FORWARD + 1 },
    (_, i) => currentYear - PERIOD_YEAR_BACK + i,
  );

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
              {isDues && duesDefault && plan && (
                <p className="text-xs text-muted-foreground">
                  {plan.full > 0 &&
                    `${plan.full} × ${formatNominal(duesDefault)} `}
                  {plan.rem > 0 &&
                    `${plan.full > 0 ? "+ cicil " : "Cicil "}${formatNominal(plan.rem)}`}
                  {plan.full > 0 || plan.rem > 0
                    ? ` = ${formatNominal(amountNum)}`
                    : ""}
                  {plan.full === 0 && plan.rem > 0 && (
                    <span className="block">
                      (kurang dari {formatNominal(duesDefault)}, tercatat cicil)
                    </span>
                  )}
                </p>
              )}
              {isDues && !duesDefault && (
                <p className="text-xs text-muted-foreground">
                  Atur nominal standar iuran di Kelola Kategori supaya nominal
                  besar otomatis dipecah ke beberapa bulan.
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

          {isDues && (
            <div className="space-y-4 rounded-xl border bg-muted/40 p-3">
              <div className="space-y-2">
                <Label>Dibayar oleh ({entityLabel})</Label>
                {payers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Belum ada {entityLabel.toLowerCase()} terdaftar.{" "}
                    <Link
                      href={duesHref}
                      className="font-medium text-primary underline"
                    >
                      Kelola {entityLabel.toLowerCase()} di halaman Iuran
                    </Link>{" "}
                    dulu.
                  </div>
                ) : (
                  <Select
                    value={duesPayerId || "__none__"}
                    onValueChange={(value: string | null) => {
                      if (value)
                        setValue("dues_payer_id", value, {
                          shouldValidate: true,
                        });
                    }}
                  >
                    <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                      <SelectValue placeholder={`Pilih ${entityLabel.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" disabled>
                        Pilih {entityLabel.toLowerCase()}
                      </SelectItem>
                      {payers.map((payer) => (
                        <SelectItem key={payer.id} value={payer.id}>
                          {payer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Periode (untuk bulan apa)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    disabled={!duesPayerId}
                    value={periodMonth ? String(periodMonth) : "__none__"}
                    onValueChange={(value: string | null) => {
                      if (!value || value === "__none__" || !periodYear) return;
                      setValue(
                        "dues_period",
                        `${periodYear}-${String(Number(value)).padStart(2, "0")}`,
                        { shouldValidate: true },
                      );
                    }}
                  >
                    <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                      <SelectValue placeholder="Bulan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" disabled>
                        Bulan
                      </SelectItem>
                      {MONTH_NAMES.map((name, index) => {
                        const monthNum = index + 1;
                        const lunas = isMonthLunas(monthNum);
                        return (
                          <SelectItem
                            key={name}
                            value={String(monthNum)}
                            disabled={periodYear === null || lunas}
                          >
                            {name}
                            {lunas && " (lunas)"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Select
                    disabled={!duesPayerId}
                    value={periodYear ? String(periodYear) : "__none__"}
                    onValueChange={(value: string | null) => {
                      if (!value || value === "__none__") return;
                      const monthPart = periodMonth
                        ? String(periodMonth).padStart(2, "0")
                        : "";
                      setValue("dues_period", `${value}-${monthPart}`, {
                        shouldValidate: true,
                      });
                    }}
                  >
                    <SelectTrigger className="h-11 w-full data-[size=default]:h-11">
                      <SelectValue placeholder="Tahun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" disabled>
                        Tahun
                      </SelectItem>
                      {periodYears.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {errors.dues_period && (
                  <p className="text-sm text-destructive">
                    {errors.dues_period.message}
                  </p>
                )}
                {!transaction && (
                  <p className="text-xs text-muted-foreground">
                    {duesPayerId ? (
                      <>
                        Bulan yang sudah lunas untuk{" "}
                        {entityLabel.toLowerCase()} terpilih dikunci; bulan yang
                        baru dicicil tetap bisa ditutup (sisa pembayaran
                        didahulukan menutupnya).
                      </>
                    ) : (
                      <>
                        Pilih {entityLabel.toLowerCase()} dulu untuk memilih
                        periode.
                      </>
                    )}
                  </p>
                )}
              </div>
              {!transaction && (
                <div className="space-y-2">
                  <Label htmlFor="duesMonths">Bayar untuk berapa bulan</Label>
                  <Input
                    id="duesMonths"
                    type="text"
                    inputMode="none"
                    readOnly
                    value={
                      isDues && duesDefault
                        ? dueCount > 0
                          ? `${dueCount} bulan`
                          : "…"
                        : "1 bulan"
                    }
                    className="h-11"
                  />
                  {isDues && duesDefault && plan && amountNum > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {plan.full > 0
                        ? `${plan.full} bulan penuh`
                        : "Cicil bulan pertama"}
                      {plan.rem > 0 &&
                        ` + cicil ${formatNominal(plan.rem)}`}
                      {plan.full > 0 &&
                        ` (total ${formatNominal(amountNum)})`}
                    </p>
                  )}
                  {isDues && !duesDefault && (
                    <p className="text-xs text-muted-foreground">
                      Isi nominal standar iuran di Kelola Kategori supaya
                      beberapa bulan sekaligus terhitung otomatis.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
              {isSubmitting
                ? dueCount > 1
                  ? `Menyimpan ${dueCount} transaksi...`
                  : "Menyimpan..."
                : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatNominal(value: number): string {
  return "Rp " + value.toLocaleString("id-ID");
}