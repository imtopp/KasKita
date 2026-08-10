"use client";

import { useRouter } from "next/navigation";

import { PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

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
  canCreateOrg,
  triggerClassName,
}: {
  orgs: OrgOption[];
  activeSlug: string;
  canCreateOrg: boolean;
  triggerClassName?: string;
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
        className={cn(
          "h-11 max-w-44 data-[size=default]:h-11 sm:max-w-64",
          triggerClassName,
        )}
        aria-label="Ganti organisasi"
      >
        <SelectValue placeholder="Pilih organisasi" />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-64">
        {orgs.map((org) => (
          <SelectItem key={org.id} value={org.slug}>
            <span className="min-w-0 flex-1 truncate">{org.name}</span>
          </SelectItem>
        ))}
        {canCreateOrg && (
          <>
            <SelectSeparator />
            <SelectItem value={CREATE_VALUE}>
              <PlusIcon />
              <span className="min-w-0 flex-1 truncate">
                Buat organisasi baru
              </span>
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
