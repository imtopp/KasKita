import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { CreateOrganizationForm } from "@/components/create-organization-form";
import { Forbidden } from "@/components/forbidden";
import { LogoutButton } from "@/components/logout-button";
import { ThemePicker } from "@/components/theme-picker";
import { ThemeSetter } from "@/components/theme-setter";
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
    .select("id, slug")
    .order("created_at", { ascending: true });

  const hasOrgs = !!orgs && orgs.length > 0;

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id);

  const isOwnerOfAnyOrg = (memberships ?? []).some(
    (membership) => membership.role === "owner",
  );

  const canCreateOrg = !hasOrgs || isOwnerOfAnyOrg;

  if (!canCreateOrg) {
    const fallbackOrg = orgs?.[0];
    return (
      <Forbidden
        fallbackHref={
          fallbackOrg ? `/org/${fallbackOrg.slug}/dashboard` : "/login"
        }
        message="Hanya owner yang bisa membuat organisasi baru."
      />
    );
  }

  const userTheme =
    typeof user.user_metadata?.theme === "string"
      ? user.user_metadata.theme
      : undefined;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 py-8">
      <ThemeSetter theme={userTheme} />
      <div className="fixed right-4 top-4 z-50">
        <ThemePicker userTheme={userTheme} />
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
