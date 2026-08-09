"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Settings,
  Tags,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { NavLinkIcon } from "@/components/nav-link-icon";

const items = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "categories", label: "Kategori", icon: Tags },
  { href: "reports", label: "Laporan", icon: BarChart3 },
  { href: "members", label: "Anggota", icon: Users },
  { href: "settings", label: "Pengaturan", icon: Settings },
];

const OWNER_ONLY = new Set(["members", "settings"]);

export function DesktopNav({
  slug,
  role,
}: {
  slug: string;
  role: string | null;
}) {
  const pathname = usePathname();

  const visibleItems = items.filter(
    (item) => !OWNER_ONLY.has(item.href) || role === "owner",
  );

  return (
    <nav className="hidden border-t bg-background md:block">
      <div className="mx-auto flex h-11 w-full max-w-5xl items-center gap-1 px-4">
        {visibleItems.map((item) => {
          const href = `/org/${slug}/${item.href}`;
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={item.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <NavLinkIcon icon={item.icon} size="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
