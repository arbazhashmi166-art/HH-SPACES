"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { syncPendingMutations } from "@/lib/repository";

export function OnlineSync() {
  const { company } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!company?.id) return;
    const sync = () => {
      syncPendingMutations(company.id)
        .then((result) => {
          if (result.synced) queryClient.invalidateQueries();
        })
        .catch(() => undefined);
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [company?.id, queryClient]);

  return null;
}
