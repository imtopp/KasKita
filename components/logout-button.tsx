"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
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
      className="h-11 w-full text-base"
    >
      Keluar
    </Button>
  );
}
