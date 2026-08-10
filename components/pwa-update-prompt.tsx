"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function PwaUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const reloading = useRef(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    const showUpdate = (worker: ServiceWorker) => {
      setWaiting(worker);
      setUpdateAvailable(true);
    };

    const onControllerChange = () => {
      if (reloading.current) {
        window.location.reload();
      }
    };

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (registration.waiting) {
        showUpdate(registration.waiting);
        return;
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showUpdate(installing);
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4 md:bottom-6">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-xl border bg-card p-3 shadow-lg shadow-black/5 animate-in slide-in-from-bottom-4 fade-in-0 duration-200 ease-out">
        <p className="min-w-0 flex-1 text-sm font-medium">
          Versi baru KasKita tersedia.
        </p>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 px-3 text-sm"
          onClick={() => {
            if (!waiting) return;
            reloading.current = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
          }}
        >
          Muat ulang
        </Button>
      </div>
    </div>
  );
}
