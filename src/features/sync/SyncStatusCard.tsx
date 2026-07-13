"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { AUTO_SYNC_EVENT, syncPendingMutations } from "@/lib/repository";
import { supabase } from "@/lib/supabase";

export function SyncStatusCard({ compact = false }: { compact?: boolean }) {
  const { company, offlineMode, session, cloudLoginIssue } = useAuth();
  const [pending, setPending] = useState(0);
  const [pendingIssue, setPendingIssue] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const cloudReady = Boolean(supabase);

  const refresh = useCallback(async () => {
    if (!company?.id) return;
    const rows = await db.pendingMutations.where({ companyId: company.id }).toArray();
    setPending(rows.length);
    setPendingIssue(rows.find((row) => row.lastError)?.lastError || null);
  }, [company?.id]);

  useEffect(() => {
    refresh().catch(() => undefined);
    const onSyncRequest = () => refresh().catch(() => undefined);
    const timer = window.setInterval(() => refresh().catch(() => undefined), 4000);
    window.addEventListener(AUTO_SYNC_EVENT, onSyncRequest);
    window.addEventListener("online", onSyncRequest);
    window.addEventListener("focus", onSyncRequest);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(AUTO_SYNC_EVENT, onSyncRequest);
      window.removeEventListener("online", onSyncRequest);
      window.removeEventListener("focus", onSyncRequest);
    };
  }, [refresh]);

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

  const friendlyIssue = pendingIssue ? explainSyncIssue(pendingIssue) : null;
  const tone = !cloudReady || offlineMode || !online ? "warning" : pending ? "warning" : "success";
  const statusText = !cloudReady
    ? "Not connected"
    : offlineMode
      ? "Saved locally"
      : pending
        ? "Saved on phone"
        : session
          ? "Cloud synced"
        : "Login needed";
  const subtitle = !cloudReady
    ? "Supabase keys are missing in this GitHub build. Add GitHub Actions secrets or use the connected build."
    : offlineMode
      ? cloudLoginIssue || "Your entries are saving on this phone/browser only. Logout, then login with ARBAZ123 or SAHIL123 to sync laptop and iPhone data."
      : online
        ? session
          ? pending
            ? "Your entries are safe on this phone. They will show on other devices after cloud sync finishes."
            : "Auto-save is on. Entries save instantly on this device and are synced to Supabase."
          : "Supabase is configured. Login with ARBAZ123 or SAHIL123 to sync this device."
        : "No internet. Entries are saved locally and queued until this device is online.";
  const actionLabel = !cloudReady
    ? "Supabase Not Configured"
    : offlineMode || !session
      ? "Login Required for Sync"
      : syncing
        ? "Syncing..."
        : pending
          ? "Sync Pending Entries"
          : "Sync Now";

  if (compact && pending === 0 && online && cloudReady && !offlineMode) return null;

  return (
    <Card>
      <CardHeader
        title={offlineMode ? "Data Save Status" : "Supabase Cloud Sync"}
        subtitle={subtitle}
        action={<Badge tone={tone}>{statusText}</Badge>}
      />
      {!compact ? (
        <p style={{ margin: "0 0 12px", color: "var(--app-muted)", fontWeight: 800, lineHeight: 1.4 }}>
          {offlineMode
            ? `${pending} saved local ${pending === 1 ? "entry is" : "entries are"} waiting for cloud sync.`
            : session
              ? pending
                ? `${pending} saved ${pending === 1 ? "entry is" : "entries are"} on this phone and not on other devices yet. ${friendlyIssue ? `Reason: ${friendlyIssue}` : "Auto-sync will retry every few seconds."}`
                : "All saved entries are synced. New entries will auto-save and auto-sync."
              : "Use ARBAZ123 or SAHIL123 login when you want the same data on laptop and phone."}
        </p>
      ) : null}
      {!compact ? (
        <Button variant="secondary" onClick={sync} disabled={syncing || !online || !cloudReady || offlineMode || !session}>
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}

function explainSyncIssue(issue: string) {
  const lower = issue.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("violates row level security")) {
    return "Supabase security rules blocked the upload. Run the latest supabase/schema.sql once, then tap Retry Sync.";
  }
  if (lower.includes("could not find the table") || lower.includes("schema cache")) {
    return "Supabase database tables are missing or outdated. Run supabase/schema.sql in Supabase SQL Editor.";
  }
  if (lower.includes("foreign key")) {
    return "A linked record, like the selected site or supplier, has not synced yet. Retry sync after a few seconds.";
  }
  if (lower.includes("duplicate") || lower.includes("unique")) {
    return "Supabase found a duplicate entry. The app will keep the phone copy and avoid creating another duplicate.";
  }
  return issue;
}
