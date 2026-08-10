"use client";

import { useEffect, useRef, useState } from "react";

import { formatRupiah } from "@/lib/utils";

export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startedRef = useRef(false);

  useEffect(() => {
    const from = startedRef.current ? fromRef.current : 0;
    const to = value;
    startedRef.current = true;
    if (from === to) return;
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{formatRupiah(Math.round(display))}</>;
}
