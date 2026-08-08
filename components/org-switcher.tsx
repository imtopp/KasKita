"use client";

import { useRouter } from "next/navigation";

import { PlusIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CREATE_VALUE = "__create__";

type OrgOption = {
  id: string;
  name: string;
  slug: string;
};

export function OrgSwitcher({
  orgs,
  activeSlug,
}: {
  orgs: OrgOption[];
  activeSlug: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={activeSlug}
      onValueChange={(value: string | null) => {
        if (!value) return;
        if (value === CREATE_VALUE) {
          router.push("/onboarding");
        } else {
          router.push(`/org/${value}/dashboard`);
        }
      }}
    >
      <SelectTrigger
        className="h-11 max-w-44 data-[size=default]:h-11"
        aria-label="Ganti organisasi"
      >
        <SelectValue placeholder="Pilih organisasi" />
      </SelectTrigger>
      <SelectContent align="end">
        {orgs.map((org) => (
          <SelectItem key={org.id} value={org.slug}>
            {org.name}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={CREATE_VALUE}>
          <PlusIcon />
          Buat organisasi baru
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
