"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Loader2,
  LogOut,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { NavLinkIcon } from "@/components/nav-link-icon";
import { createClient } from "@/lib/supabase/client";

const items = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "reports", label: "Laporan", icon: BarChart3 },
  { href: "members", label: "Anggota", icon: Users },
  { href: "settings", label: "Pengaturan", icon: Settings },
];

export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setPending(false);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background md:hidden">
      <div className="grid h-16 grid-cols-6">
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
              <NavLinkIcon icon={item.icon} size="size-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          disabled={pending}
          className="flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground"
        >
          {pending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <LogOut className="size-5" aria-hidden />
          )}
          Keluar
        </button>
      </div>
    </nav>
  );
}
