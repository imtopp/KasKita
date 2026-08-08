import { notFound } from "next/navigation";

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
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>{org.name}</CardTitle>
          <CardDescription>
            Ringkasan saldo menyusul (TASK 6).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            Slug: <code>{org.slug}</code>
          </p>
          <p>Kategori default: {categoryCount ?? 0} (verifikasi trigger)</p>
        </CardContent>
      </Card>
    </div>
  );
}
