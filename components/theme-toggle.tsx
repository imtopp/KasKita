"use client";

import { Building2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const THEME_KEY = "kaskita-theme";

export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "kawaii" ? "klasik" : "kawaii";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* abaikan jika localStorage tidak tersedia */
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label="Ganti tema"
      title="Ganti tema (Kawaii / Klasik)"
      className={cn("h-11 w-11 rounded-full bg-background", className)}
    >
      <Sparkles className="hidden [html[data-theme=kawaii]_&]:block" />
      <Building2 className="block [html[data-theme=kawaii]_&]:hidden" />
    </Button>
  );
}
