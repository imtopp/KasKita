import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function formatRupiah(value: number): string {
  return "Rp " + value.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatDateID(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function categoryFromEmbedded(
  embedded: { name: string } | { name: string }[] | null | undefined,
): { name: string } | null {
  if (!embedded) return null;
  return Array.isArray(embedded) ? embedded[0] ?? null : embedded;
}

export type DatePresetKey = "today" | "7d" | "month" | "30d";

export function dateRangeForPreset(
  key: DatePresetKey,
): { from: string; to: string } {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const iso = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  switch (key) {
    case "today": {
      const from = todayISO();
      return { from, to: from };
    }
    case "7d": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      return { from: iso(from), to: todayISO() };
    }
    case "30d": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      return { from: iso(from), to: todayISO() };
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: iso(first), to: iso(last) };
    }
  }
}
