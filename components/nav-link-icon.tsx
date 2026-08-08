"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function NavLinkIcon({
  icon: Icon,
  size,
}: {
  icon: LucideIcon;
  size: string;
}) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 aria-hidden className={cn(size, "animate-spin")} />
  ) : (
    <Icon className={size} />
  );
}
