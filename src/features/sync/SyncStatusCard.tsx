"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { syncPendingMutations } from "@/lib/repository";

export function SyncStatusCard({ compact = false }: { compact?: boolean }) {
  const { company } = useAuth();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  const refresh = async () => {
    if (!company?.id) return;
    const count = await db.pendingMutations.where({ companyId: company.id }).count();
    setPending(count);
  };

  useEffect(() => {
    refresh().catch(() => undefined);
    const timer = window.setInterval(() => refresh().catch(() => undefined), 4000);
    return () => window.clearInterval(timer);
  });

  const sync = async () => {
    if (!company?.id) return;
    setSyncing(true);
    try {
      await syncPendingMutations(company.id);
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  if (compact && pending === 0 && online) return null;

  return (
    <Card>
      <CardHeader
        title="Offline Sync"
        subtitle={online ? "Online. Pending local entries will sync automatically." : "Offline. Entries are saved locally and queued."}
        action={<Badge tone={pending ? "warning" : "success"}>{pending} pending</Badge>}
      />
      {!compact ? (
        <Button variant="secondary" onClick={sync} disabled={syncing || !online}>
          {syncing ? "Syncing..." : "Retry Sync"}
        </Button>
      ) : null}
    </Card>
  );
}
