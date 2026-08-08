"use client";

import { useEffect } from "react";

import { THEME_KEY, THEMES } from "@/components/theme-picker";

export function ThemeSetter({ theme }: { theme?: string }) {
  const next: string =
    theme && THEMES.some((t) => t.id === theme) ? theme : "klasik";

  useEffect(() => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* abaikan jika localStorage tidak tersedia */
    }
  }, [next]);

  return null;
}
