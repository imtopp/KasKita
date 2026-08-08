import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
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

  redirect("/onboarding");
}
