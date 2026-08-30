import { notFound, redirect } from "next/navigation";

import { Forbidden } from "@/components/forbidden";
import { OrgDeleteButton } from "@/components/org-delete-button";
import { OrgDuesLabelForm } from "@/components/org-dues-label-form";
import { OrgNameForm } from "@/components/org-name-form";
import { OrgSlugForm } from "@/components/org-slug-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  co_owner: "Co-owner",
  treasurer: "Bendahara",
  viewer: "Viewer",
};

const ROLE_ORDER = ["owner", "co_owner", "treasurer", "viewer"];

export default async function SettingsPage({
  params,
}: {
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

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, created_at, dues_entity_label")
    .eq("slug", slug)
    .single();
  if (!org) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner" && membership?.role !== "co_owner") {
    return <Forbidden fallbackHref={`/org/${slug}/dashboard`} />;
  }

  const { data: memberRows } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id);

  const roleCounts: Record<string, number> = {};
  for (const row of memberRows ?? []) {
    roleCounts[row.role] = (roleCounts[row.role] ?? 0) + 1;
  }
  const totalMembers = (memberRows ?? []).length;

  const createdAt = new Date(org.created_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">
          Pengaturan untuk organisasi {org.name}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi organisasi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Nama</span>
            <span className="text-sm font-semibold text-right">{org.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Alamat (slug)</span>
            <span className="text-sm font-semibold text-right">{org.slug}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Dibuat</span>
            <span className="text-sm font-semibold text-right">
              {createdAt}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Total anggota</span>
            <span className="text-sm font-semibold text-right">
              {totalMembers}
            </span>
          </div>
          <div className="border-t pt-3">
            {ROLE_ORDER.filter((role) => roleCounts[role]).map((role) => (
              <div
                key={role}
                className="flex items-center justify-between gap-3 py-1"
              >
                <span className="text-sm text-muted-foreground">
                  {ROLE_LABELS[role]}
                </span>
                <span className="text-sm font-semibold">
                  {roleCounts[role]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ubah nama organisasi</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgNameForm orgId={org.id} currentName={org.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ubah alamat (slug)</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgSlugForm orgId={org.id} currentSlug={org.slug} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ubah label unit iuran</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgDuesLabelForm
            orgId={org.id}
            currentLabel={org.dues_entity_label ?? "Warga"}
          />
        </CardContent>
      </Card>

      {membership?.role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Zona berbahaya
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Menghapus organisasi akan menghapus semua data secara permanen.
              Hanya owner yang bisa melakukan ini.
            </p>
            <OrgDeleteButton orgId={org.id} orgName={org.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
