"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db, lastSyncMetaKey, type PendingMutation } from "@/lib/db";
import { AUTO_SYNC_EVENT, isSchemaSetupError, syncPendingMutations } from "@/lib/repository";
import { supabase } from "@/lib/supabase";

export type SyncTone = "success" | "warning" | "neutral";
export type SyncState = "synced" | "syncing" | "pending" | "failed" | "setup_needed" | "offline" | "login_required" | "not_configured";

type ManualSyncOptions = {
  retrySetupBlocked?: boolean;
};

type SyncStatusInput = {
  companyId?: string;
  offlineMode: boolean;
  hasSession: boolean;
  cloudLoginIssue?: string | null;
};

export function useSyncStatus({ companyId, offlineMode, hasSession, cloudLoginIssue }: SyncStatusInput) {
  const [pendingRows, setPendingRows] = useState<PendingMutation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const cloudReady = Boolean(supabase);

  const refresh = useCallback(async () => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    if (!companyId) {
      setPendingRows([]);
      setLastSyncedAt(null);
      return;
    }
    const rows = await db.pendingMutations.where({ companyId }).toArray();
    const lastSync = await db.meta.get(lastSyncMetaKey(companyId));
    setPendingRows(rows);
    setLastSyncedAt(typeof lastSync?.value === "string" ? lastSync.value : null);
  }, [companyId]);

  useEffect(() => {
    refresh().catch(() => undefined);
    const onSyncSignal = () => refresh().catch(() => undefined);
    const timer = window.setInterval(onSyncSignal, 4000);
    window.addEventListener(AUTO_SYNC_EVENT, onSyncSignal);
    window.addEventListener("online", onSyncSignal);
    window.addEventListener("offline", onSyncSignal);
    window.addEventListener("focus", onSyncSignal);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(AUTO_SYNC_EVENT, onSyncSignal);
      window.removeEventListener("online", onSyncSignal);
      window.removeEventListener("offline", onSyncSignal);
      window.removeEventListener("focus", onSyncSignal);
    };
  }, [refresh]);

  const sync = useCallback(async (options: ManualSyncOptions = {}) => {
    if (!companyId) return;
    setSyncing(true);
    try {
      await syncPendingMutations(companyId, options);
      await refresh();
    } finally {
      setSyncing(false);
    }
  }, [companyId, refresh]);

  return useMemo(() => {
    const failedRows = pendingRows.filter((row) => row.lastError);
    const pendingCount = pendingRows.length;
    const failedCount = failedRows.length;
    const schemaSetupCount = failedRows.filter((row) => row.lastError && isSchemaSetupError(row.lastError)).length;
    const onlySchemaSetupIssues = failedCount > 0 && schemaSetupCount === failedCount;
    const firstIssue = failedRows[0]?.lastError || null;
    const friendlyIssue = firstIssue ? explainSyncIssue(firstIssue) : null;
    const state: SyncState = !cloudReady
      ? "not_configured"
      : offlineMode || !online
        ? "offline"
        : onlySchemaSetupIssues
          ? "setup_needed"
          : failedCount
            ? "failed"
            : syncing
              ? "syncing"
              : pendingCount
                ? "pending"
                : hasSession
                  ? "synced"
                  : "login_required";
    const label =
      state === "not_configured"
        ? "Cloud not connected"
        : state === "offline"
          ? "Offline - saved on phone"
          : state === "setup_needed"
            ? "Cloud setup needed"
            : state === "failed"
              ? `${failedCount} sync ${failedCount === 1 ? "failed" : "failed"}`
              : state === "syncing"
                ? `Syncing ${pendingCount} ${pendingCount === 1 ? "entry" : "entries"}...`
                : state === "pending"
                  ? `${pendingCount} waiting to sync`
                  : state === "synced"
                    ? "All synced"
                    : "Login for cloud sync";
    const detail =
      state === "not_configured"
        ? "Supabase keys are missing in this build."
        : state === "offline"
          ? cloudLoginIssue || "Entries are saved on this phone until internet/cloud login works."
          : state === "setup_needed"
            ? "Your entries are safe on this phone. Update Supabase tables once, then tap Check Again."
            : state === "failed"
              ? friendlyIssue || "Open Sync Centre and retry upload."
              : state === "syncing"
                ? "Uploading phone entries to Supabase."
                : state === "pending"
                  ? "Entries are safe on this phone and will upload automatically."
                  : state === "synced"
                    ? lastSyncedAt
                      ? `Last checked ${new Date(lastSyncedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.`
                      : "Phone and cloud are connected."
                    : "Sign in to share data across phone and laptop.";
    const tone: SyncTone = state === "synced" ? "success" : state === "login_required" ? "neutral" : "warning";

    return {
      pendingRows,
      failedRows,
      pendingCount,
      failedCount,
      schemaSetupCount,
      firstIssue,
      friendlyIssue,
      online,
      cloudReady,
      syncing,
      lastSyncedAt,
      state,
      label,
      detail,
      tone,
      sync,
      refresh
    };
  }, [cloudLoginIssue, cloudReady, hasSession, lastSyncedAt, offlineMode, online, pendingRows, refresh, sync, syncing]);
}

export function explainSyncIssue(issue: string) {
  const lower = issue.toLowerCase();
  if (
    lower.includes("42501") ||
    lower.includes("permission denied") ||
    lower.includes("insufficient_privilege") ||
    lower.includes("row-level security") ||
    lower.includes("violates row level security")
  ) {
    return "Supabase security rules blocked the upload. Run the latest supabase/schema.sql once, then tap Retry Sync.";
  }
  if (isSchemaSetupError(issue)) {
    return "Supabase database tables are missing or outdated. Run supabase/schema.sql in Supabase SQL Editor, then tap Check Again.";
  }
  if (lower.includes("foreign key")) {
    return "A linked record, like the selected site or supplier, has not synced yet. Retry sync after a few seconds.";
  }
  if (lower.includes("duplicate") || lower.includes("unique")) {
    return "Supabase found a duplicate entry. The app will keep the phone copy and avoid creating another duplicate.";
  }
  if (lower.includes("jwt") || lower.includes("session") || lower.includes("auth")) {
    return "Cloud login session needs refresh. Logout and login again, then retry sync.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("timeout")) {
    return "Internet or Supabase connection failed. Your entry is safe on this phone; retry when the network is stable.";
  }
  return issue;
}
