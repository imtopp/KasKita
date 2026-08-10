"use client";

import { useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { Building2, Loader2, PlusIcon } from "lucide-react";

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
}: {
  orgs: OrgOption[];
  activeSlug: string;
  canCreateOrg: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [prevSlug, setPrevSlug] = useState(activeSlug);

  if (activeSlug !== prevSlug) {
    setPrevSlug(activeSlug);
    setPendingPath(null);
  }

  const isSwitching =
    pendingPath !== null && !pathname.startsWith(pendingPath);

  useEffect(() => {
    if (!isSwitching) return;
    const timeout = setTimeout(() => setPendingPath(null), 10000);
    return () => clearTimeout(timeout);
  }, [isSwitching]);

  const handleValueChange = (value: string | null) => {
    if (!value || value === activeSlug) return;
    setPendingPath(
      value === CREATE_VALUE ? "/onboarding" : `/org/${value}/dashboard`,
    );
    if (value === CREATE_VALUE) {
      router.push("/onboarding");
    } else {
      router.push(`/org/${value}/dashboard`);
    }
  };

  return (
    <Select value={activeSlug} onValueChange={handleValueChange}>
      <SelectTrigger
        className="h-11 max-w-44 data-[size=default]:h-11 sm:max-w-64"
        aria-label="Ganti organisasi"
        disabled={isSwitching}
      >
        {isSwitching ? (
          <Loader2
            className="size-4 shrink-0 animate-spin md:hidden"
            aria-hidden
          />
        ) : (
          <Building2 className="size-4 shrink-0 md:hidden" aria-hidden />
        )}
        {isSwitching ? (
          <span className="max-md:sr-only text-muted-foreground">
            Memuat…
          </span>
        ) : (
          <SelectValue className="max-md:sr-only" />
        )}
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
