import { notFound } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (error || !org) {
    notFound();
  }

  const { count: categoryCount } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{org.name}</CardTitle>
          <CardDescription>
            Dashboard placeholder — tata letak lengkap menyusul.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 text-sm">
            <p>
              Slug: <code>{org.slug}</code>
            </p>
            <p>
              Kategori default: {categoryCount ?? 0} (verifikasi trigger)
            </p>
          </div>
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  );
}
