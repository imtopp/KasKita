"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const THRESHOLD = 64;
const MAX_PULL = 96;

export function PullToRefresh({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const delta = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reset = () => {
      startY.current = null;
      delta.current = 0;
      setPulling(false);
      setPullY(0);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (disabled || isRefreshing) return;
      if (event.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      startY.current = event.touches[0].clientY;
      delta.current = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (disabled || isRefreshing || startY.current === null) return;
      const next = event.touches[0].clientY - startY.current;
      if (next <= 0 || window.scrollY > 0) {
        reset();
        return;
      }
      event.preventDefault();
      delta.current = next;
      setPulling(true);
      setPullY(Math.min(next * 0.45, MAX_PULL));
    };

    const onTouchEnd = () => {
      if (startY.current === null) return;
      const shouldRefresh = delta.current >= THRESHOLD;
      reset();
      if (shouldRefresh && !disabled) {
        startTransition(() => router.refresh());
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, isRefreshing, router]);

  const indicatorY = pulling ? pullY : isRefreshing ? 40 : 0;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 -top-10 flex h-10 items-center justify-center",
          !pulling && "transition-transform duration-200",
        )}
        style={{
          transform: `translateY(${indicatorY}px)`,
          opacity:
            pulling || isRefreshing
              ? Math.min(indicatorY / THRESHOLD, 1)
              : 0,
        }}
      >
        <Loader2
          className={cn(
            "size-5 text-muted-foreground",
            isRefreshing && "animate-spin",
          )}
          aria-hidden
        />
      </div>
      <div
        className={cn(!pulling && "transition-transform duration-200")}
        style={{ transform: pulling ? `translateY(${pullY}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
