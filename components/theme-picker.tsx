"use client";

import { useState } from "react";

import { Loader2, Palette } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const THEME_KEY = "kaskita-theme";

export const THEMES = [
  { id: "klasik", label: "Klasik", color: "#0f766e" },
  { id: "kawaii", label: "Kawaii", color: "#f6a6c4" },
  { id: "ocean", label: "Ocean", color: "#3b82f6" },
  { id: "forest", label: "Forest", color: "#16a34a" },
  { id: "sunrise", label: "Sunrise", color: "#f59e0b" },
] as const;

export function ThemePicker({
  userTheme,
  className,
}: {
  userTheme?: string;
  className?: string;
}) {
  const supabase = createClient();
  const [theme, setTheme] = useState<string>(
    userTheme ?? "klasik",
  );
  const [saving, setSaving] = useState(false);

  async function apply(value: string | null) {
    if (!value || saving) return;
    const next = THEMES.some((t) => t.id === value) ? value : "klasik";
    setSaving(true);
    setTheme(next);
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    root.dataset.theme = next;
    window.setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 500);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* abaikan jika localStorage tidak tersedia */
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.updateUser({ data: { theme: next } });
      }
    } catch {
      /* simpan lokal tetap berlaku walau updateUser gagal */
    }
    setSaving(false);
  }

  return (
    <Select value={theme} onValueChange={apply} disabled={saving}>
      <SelectTrigger
        aria-label="Pilih tema"
        className={cn(
          "h-11 max-w-44 data-[size=default]:h-11",
          className,
        )}
      >
        {saving ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Palette className="size-4 shrink-0" aria-hidden />
        )}
        <SelectValue className="sr-only" />
      </SelectTrigger>
      <SelectContent align="end">
        {THEMES.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <span className="flex items-center gap-2">
              <span
                className="size-3 rounded-full ring-1 ring-primary/20"
                style={{ backgroundColor: t.color }}
              />
              {t.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
