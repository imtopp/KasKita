"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "reports", label: "Laporan", icon: BarChart3 },
  { href: "members", label: "Anggota", icon: Users },
  { href: "settings", label: "Pengaturan", icon: Settings },
];

export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background md:hidden">
      <div className="grid h-16 grid-cols-5">
        {items.map((item) => {
          const href = `/org/${slug}/${item.href}`;
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px]",
                active
                  ? "font-bold text-primary"
                  : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
