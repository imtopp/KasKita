import { redirect } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { BrandLogo } from "@/components/brand-logo";
import { DesktopNav } from "@/components/desktop-nav";
import { Forbidden } from "@/components/forbidden";
import { LogoutButton } from "@/components/logout-button";
import { OrgSwitcher } from "@/components/org-switcher";
import { ThemePicker } from "@/components/theme-picker";
import { ThemeSetter } from "@/components/theme-setter";
import { createClient } from "@/lib/supabase/server";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  if (user.user_metadata?.must_change_password) {
    redirect("/update-password?forced=1");
  }

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .order("created_at", { ascending: true });

  const activeOrg = orgs?.find((org) => org.slug === slug);

  if (!activeOrg) {
    const fallback = orgs?.[0];
    return (
      <Forbidden
        fallbackHref={
          fallback ? `/org/${fallback.slug}/dashboard` : "/onboarding"
        }
      />
    );
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id);
  const canCreateOrg =
    (orgs?.length ?? 0) === 0 ||
    (memberships ?? []).some((membership) => membership.role === "owner");

  const userTheme =
    typeof user.user_metadata?.theme === "string"
      ? user.user_metadata.theme
      : undefined;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", activeOrg.id)
    .eq("user_id", user.id)
    .single();
  const role: string | null = membership?.role ?? null;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <ThemeSetter theme={userTheme} />
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo size={28} className="ring-0" />
            <p className="truncate text-sm font-bold">{activeOrg.name}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <OrgSwitcher
              orgs={orgs ?? []}
              activeSlug={slug}
              canCreateOrg={canCreateOrg}
            />
            <ThemePicker userTheme={userTheme} />
            <LogoutButton className="hidden h-9 w-auto shrink-0 px-3 text-sm md:inline-flex" />
          </div>
        </div>
        <DesktopNav slug={slug} role={role} />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:py-6">
        {children}
      </main>
      <BottomNav slug={slug} role={role} />
    </div>
  );
}
