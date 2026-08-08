import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Logo KasKita"
      width={size}
      height={size}
      priority
      style={{ width: size, height: size }}
      className={cn(
        "rounded-2xl bg-white shadow-md shadow-primary/20 ring-1 ring-primary/15",
        className,
      )}
    />
  );
}
