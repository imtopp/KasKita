import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
export const RECEIPT_MAX_MB = 15;

export function receiptPath(orgId: string): string {
  return `${orgId}/${crypto.randomUUID()}.jpg`;
}

export function receiptFileError(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "File harus berupa gambar (JPG/PNG/HEIC).";
  }
  if (file.size > RECEIPT_MAX_MB * 1024 * 1024) {
    return `Ukuran file maksimal ${RECEIPT_MAX_MB} MB.`;
  }
  return null;
}

export async function compressReceiptImage(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal membaca gambar."));
      img.src = objectUrl;
    });

    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(image.width, image.height),
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Browser tidak mendukung pengompresan gambar.");
    }
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) {
      throw new Error("Gagal mengompres foto.");
    }
    return new File([blob], "receipt.jpg", {
      type: blob.type || "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Pesan error upload yang manusiawi (dipakai di form transaksi).
export function uploadReceiptError(error: { message: string }): string {
  if (/row-level security|permission denied|new row violates/i.test(error.message)) {
    return "Kamu tidak punya izin untuk mengunggah bukti transaksi.";
  }
  if (/exceed|too large|payload/i.test(error.message)) {
    return "Ukuran file melebihi batas yang diizinkan (maks 5 MB).";
  }
  return "Gagal mengunggah foto. Coba lagi.";
}

// Hapus 1 file bukti. Best-effort: kegagalan tidak boleh menggagalkan
// alur utama (mis. setelah transaksi berhasil dihapus).
export async function deleteReceipt(
  supabase: SupabaseClient,
  path: string | null,
): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from("receipts").remove([path]);
  if (error) {
    console.error("Gagal menghapus file bukti:", error.message);
  }
}

// Hapus SEMUA file bukti milik organisasi (dipakai sebelum org dihapus,
// supaya tidak ada file yatim yang nyangkut sampai penuh limit storage).
export async function deleteOrgReceipts(
  supabase: SupabaseClient,
  orgId: string,
): Promise<void> {
  const { data, error } = await supabase.storage
    .from("receipts")
    .list(orgId, { limit: 1000 });
  if (error) throw error;

  const paths = (data ?? [])
    .filter((entry) => entry.id)
    .map((entry) => `${orgId}/${entry.name}`);
  if (paths.length === 0) return;

  const { error: removeError } = await supabase.storage
    .from("receipts")
    .remove(paths);
  if (removeError) throw removeError;
}