import { redirect } from "next/navigation";

import { CreateOrganizationForm } from "@/components/create-organization-form";
import { LogoutButton } from "@/components/logout-button";
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
    .select("slug")
    .order("created_at", { ascending: true });

  if (orgs && orgs.length > 0) {
    redirect(`/org/${orgs[0].slug}/dashboard`);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Selamat datang di KasKita!</CardTitle>
          <CardDescription>
            Buat organisasi pertamamu untuk mulai mengelola kas.
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
