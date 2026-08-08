import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { CreateOrganizationForm } from "@/components/create-organization-form";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id")
    .limit(1);

  const hasOrgs = !!orgs && orgs.length > 0;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 py-8">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-2">
        <BrandLogo size={72} />
        <p className="text-2xl font-extrabold tracking-tight">KasKita</p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {hasOrgs ? "Buat organisasi baru" : "Selamat datang di KasKita!"}
          </CardTitle>
          <CardDescription>
            {hasOrgs
              ? "Buat organisasi lain untuk mulai mengelola kas terpisah."
              : "Buat organisasi pertamamu untuk mulai mengelola kas."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CreateOrganizationForm />
          <div className="flex justify-center">
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
