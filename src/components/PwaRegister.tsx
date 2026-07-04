"use client";

import { useEffect, useState } from "react";
import { basePath } from "@/lib/env";

export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker.register(`${basePath || ""}/sw.js`, { scope: `${basePath || ""}/` }).then((registration) => {
      registration.update().catch(() => undefined);
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return (
    updateReady ? (
      <button
        type="button"
        onClick={() => {
          navigator.serviceWorker.getRegistration(`${basePath || ""}/`)?.then((registration) => {
            registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          });
        }}
        style={{
          position: "fixed",
          left: 14,
          right: 14,
          bottom: "calc(18px + env(safe-area-inset-bottom))",
          zIndex: 100,
          minHeight: 54,
          border: 0,
          borderRadius: 18,
          background: "var(--app-primary)",
          color: "#fff",
          fontWeight: 900,
          boxShadow: "0 16px 34px rgba(59,91,255,.34)"
        }}
      >
        App update ready. Tap to refresh.
      </button>
    ) : null
  );
}
