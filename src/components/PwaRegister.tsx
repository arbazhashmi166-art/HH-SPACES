"use client";

import { useEffect, useState } from "react";
import { basePath } from "@/lib/env";

export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register(`${basePath || ""}/sw.js`, { scope: `${basePath || ""}/` }).then((registration) => {
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
    });
  }, []);

  return (
    updateReady ? (
      <button
        type="button"
        onClick={() => setUpdateReady(false)}
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
        App update ready. Close and reopen the app.
      </button>
    ) : null
  );
}
