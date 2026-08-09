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

const OWNER_ONLY = new Set(["members", "settings"]);

export function BottomNav({
  slug,
  role,
}: {
  slug: string;
  role: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [pending, setPending] = useState(false);

  const visibleItems = items.filter(
    (item) =>
      !OWNER_ONLY.has(item.href) ||
      role === "owner" ||
      role === "co_owner",
  );

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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <div
        className="grid h-16"
        style={{
          gridTemplateColumns: `repeat(${visibleItems.length + 1}, minmax(0, 1fr))`,
        }}
      >
        {visibleItems.map((item) => {
          const href = `/org/${slug}/${item.href}`;
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] transition-colors duration-200 [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out",
                active
                  ? "font-bold text-primary [&_svg]:scale-110"
                  : "text-muted-foreground hover:text-foreground",
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
          className="flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground transition-colors duration-200 hover:text-foreground [&_svg]:transition-transform [&_svg]:duration-200 active:[&_svg]:scale-90"
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
