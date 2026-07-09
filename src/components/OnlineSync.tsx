"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AUTO_SYNC_EVENT, syncPendingMutations } from "@/lib/repository";

export function OnlineSync() {
  const { company, offlineMode, session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!company?.id || offlineMode || !session) return;
    let syncing = false;
    let queued = false;

    const sync = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (syncing) {
        queued = true;
        return;
      }
      syncing = true;
      syncPendingMutations(company.id)
        .then((result) => {
          if (result.synced) queryClient.invalidateQueries();
        })
        .catch(() => undefined)
        .finally(() => {
          syncing = false;
          if (queued) {
            queued = false;
            window.setTimeout(sync, 800);
          }
        });
    };

    const syncOnVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    const syncOnRequest = (event: Event) => {
      const companyId = (event as CustomEvent<{ companyId?: string }>).detail?.companyId;
      if (!companyId || companyId === company.id) window.setTimeout(sync, 500);
    };

    sync();
    const timer = window.setInterval(sync, 15_000);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    window.addEventListener(AUTO_SYNC_EVENT, syncOnRequest);
    document.addEventListener("visibilitychange", syncOnVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener(AUTO_SYNC_EVENT, syncOnRequest);
      document.removeEventListener("visibilitychange", syncOnVisible);
    };
  }, [company?.id, offlineMode, queryClient, session]);

  return null;
}
