import { redirect } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { Forbidden } from "@/components/forbidden";
import { LogoutButton } from "@/components/logout-button";
import { OrgSwitcher } from "@/components/org-switcher";
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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <p className="truncate text-sm font-semibold">{activeOrg.name}</p>
          <div className="ml-auto flex items-center gap-2">
            <OrgSwitcher orgs={orgs ?? []} activeSlug={slug} />
            <LogoutButton className="hidden h-9 px-3 text-sm md:inline-flex" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 md:py-6">
        {children}
      </main>
      <BottomNav slug={slug} />
    </div>
  );
}
