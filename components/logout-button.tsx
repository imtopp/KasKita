"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
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
    <Button
      variant="outline"
      onClick={handleLogout}
      disabled={pending}
      className={cn("h-11 w-full text-base", className)}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      Keluar
    </Button>
  );
}
