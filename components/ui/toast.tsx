"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "destructive";

type ToastOptions = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
};

type ToastContextValue = {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast harus dipakai di dalam <ToastProvider>.");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random()}`;
      const duration = options.duration ?? DEFAULT_DURATION;
      setItems((prev) => [
        ...prev,
        {
          id,
          title: options.title,
          description: options.description,
          variant: options.variant ?? "default",
          action: options.action,
        },
      ]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          aria-live="polite"
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg shadow-black/20 animate-in slide-in-from-bottom-4 fade-in-0 duration-200 ease-out",
            item.variant === "destructive"
              ? "border-destructive-foreground/30 bg-destructive text-destructive-foreground"
              : "border-background/20 bg-foreground text-background",
          )}
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            {item.title && (
              <p className="text-sm font-semibold">{item.title}</p>
            )}
            {item.description && (
              <p
                className={cn(
                  "text-sm",
                  item.variant === "destructive"
                    ? "text-destructive-foreground/80"
                    : "text-background/70",
                )}
              >
                {item.description}
              </p>
            )}
          </div>
          {item.action && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-9 shrink-0 rounded-full px-3 text-sm"
              onClick={() => {
                item.action?.onClick();
                onDismiss(item.id);
              }}
            >
              {item.action.label}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
