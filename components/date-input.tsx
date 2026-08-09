import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function DateInput({
  className,
  emptyHint = "dd/mm/yyyy",
  value,
  ...props
}: React.ComponentProps<"input"> & { emptyHint?: string }) {
  const isEmpty = !value;
  return (
    <div className="relative min-w-0">
      <Input
        type="date"
        className={cn(
          "h-11",
          isEmpty &&
            "[&::-webkit-datetime-edit]:text-transparent [&::-webkit-datetime-edit-fields-wrapper]:text-transparent",
          className,
        )}
        value={value}
        {...props}
      />
      {isEmpty && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted-foreground supports-[-webkit-touch-callout:none]:hidden"
        >
          {emptyHint}
        </span>
      )}
    </div>
  );
}

export { DateInput };
