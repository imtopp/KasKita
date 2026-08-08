"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) return;
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      className={cn("h-11 w-full text-base", className)}
    >
      Keluar
    </Button>
  );
}
