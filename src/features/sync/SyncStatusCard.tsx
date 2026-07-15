import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { PendingMutation } from "@/lib/db";
import type { TableName } from "@/types/domain";
import { explainSyncIssue, useSyncStatus } from "./useSyncStatus";
import styles from "./SyncStatusCard.module.css";

const tableLabels: Partial<Record<TableName, string>> = {
  sites: "Site",
  labour: "Labour",
  attendance: "Attendance",
  materials: "Material",
  expenses: "Expense",
  client_payments: "Client payment",
  supplier_payments: "Supplier payment",
  partner_draws: "Partner draw",
  daily_closings: "Daily closing",
  approval_requests: "Approval",
  progress_updates: "Progress",
  extra_works: "Extra work",
  reminders: "Reminder",
  activity_logs: "Activity"
};

function operationLabel(operation: PendingMutation["operationType"]) {
  if (operation === "insert") return "New entry";
  if (operation === "update") return "Updated entry";
  if (operation === "delete") return "Deleted entry";
  return "Photo upload";
}

function mutationTitle(row: PendingMutation) {
  const payload = row.payload;
  const title =
    payload.name ||
    payload.full_name ||
    payload.material_name ||
    payload.title ||
    payload.description ||
    payload.partner_name ||
    payload.category ||
    payload.date ||
    row.recordId;
  return String(title);
}

function mutationTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function SyncStatusCard({ compact = false }: { compact?: boolean }) {
  const { company, offlineMode, session, cloudLoginIssue } = useAuth();
  const syncStatus = useSyncStatus({
    companyId: company?.id,
    offlineMode,
    hasSession: Boolean(session),
    cloudLoginIssue
  });
  const subtitle = !syncStatus.cloudReady
    ? "Supabase keys are missing in this GitHub build. Add GitHub Actions secrets or use the connected build."
    : offlineMode
      ? cloudLoginIssue || "Your entries are safe on this phone. Logout, then login with ARBAZ123 or SAHIL123 when you want laptop and iPhone sharing."
      : syncStatus.online
        ? session
          ? syncStatus.pendingCount
            ? "Supabase login is active. New entries are saved safely on this phone first, then uploaded to Supabase. The pending entries will show on other devices after upload finishes."
            : "Supabase login is active. Entries save instantly on this phone and are already synced to Supabase."
          : "Supabase is configured. Login with ARBAZ123 or SAHIL123 to sync this device."
        : "No internet. Entries are saved locally and queued until this device is online.";
  const actionLabel = !syncStatus.cloudReady
    ? "Supabase Not Configured"
    : offlineMode || !session
      ? "Login Required for Sync"
      : syncStatus.syncing
        ? "Syncing..."
        : syncStatus.pendingCount
          ? "Retry Upload"
          : "Sync Now";

  if (compact && syncStatus.pendingCount === 0 && syncStatus.online && syncStatus.cloudReady && !offlineMode) return null;

  return (
    <Card>
      <CardHeader
        title={offlineMode ? "Data Save Status" : "Supabase Cloud Sync"}
        subtitle={subtitle}
        action={<Badge tone={syncStatus.tone}>{syncStatus.label}</Badge>}
      />
      {!compact ? (
        <div className={styles.syncSummary} aria-label="Sync centre summary">
          <div>
            <span>Cloud</span>
            <strong>{syncStatus.cloudReady ? (session && !offlineMode ? "Connected" : "Login needed") : "Not configured"}</strong>
          </div>
          <div>
            <span>Phone backup</span>
            <strong>{syncStatus.pendingCount ? `${syncStatus.pendingCount} waiting` : "Clear"}</strong>
          </div>
          <div>
            <span>Last sync</span>
            <strong>{syncStatus.lastSyncedAt ? mutationTime(syncStatus.lastSyncedAt) : "Not yet"}</strong>
          </div>
        </div>
      ) : null}
      {!compact ? (
        <p style={{ margin: "0 0 12px", color: "var(--app-muted)", fontWeight: 800, lineHeight: 1.4 }}>
          {offlineMode
            ? syncStatus.pendingCount
              ? `${syncStatus.pendingCount} ${syncStatus.pendingCount === 1 ? "entry is" : "entries are"} safe on this phone. Login to upload to cloud.`
              : "Entries are saving on this phone. Login for cloud sharing when needed."
            : session
              ? syncStatus.pendingCount
                ? `${syncStatus.pendingCount} ${syncStatus.pendingCount === 1 ? "entry is" : "entries are"} backed up on this phone and waiting to upload to Supabase. ${syncStatus.friendlyIssue ? `Reason: ${syncStatus.friendlyIssue}` : "Auto-sync will retry every few seconds."}`
                : "All entries are synced with Supabase. New entries will auto-save on this phone first, then sync to cloud."
              : "Use ARBAZ123 or SAHIL123 login when you want the same data on laptop and phone."}
        </p>
      ) : null}
      {!compact ? (
        <div className={styles.syncCentre}>
          <div className={styles.syncCentreHeader}>
            <strong>Sync Centre</strong>
            <span>{syncStatus.pendingCount ? "Entries below are safe on this phone." : "No waiting phone entries."}</span>
          </div>
          {syncStatus.pendingRows.length ? (
            <div className={styles.pendingList}>
              {syncStatus.pendingRows.slice(0, 6).map((row) => (
                <div className={styles.pendingItem} key={row.id}>
                  <div>
                    <strong>{mutationTitle(row)}</strong>
                    <p>
                      {tableLabels[row.table] || row.table} - {operationLabel(row.operationType)} - {mutationTime(row.updatedAt)}
                    </p>
                    {row.lastError ? <small>{explainSyncIssue(row.lastError)}</small> : null}
                  </div>
                  <Badge tone={row.lastError ? "danger" : "warning"}>{row.lastError ? "Retry needed" : "Waiting"}</Badge>
                </div>
              ))}
              {syncStatus.pendingRows.length > 6 ? (
                <p className={styles.moreRows}>{syncStatus.pendingRows.length - 6} more entries are waiting to upload.</p>
              ) : null}
            </div>
          ) : (
            <div className={styles.clearState}>
              <strong>All phone entries are clear</strong>
              <p>New work will save on this phone first and upload automatically when cloud sync is available.</p>
            </div>
          )}
        </div>
      ) : null}
      {!compact ? (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={syncStatus.sync} disabled={syncStatus.syncing || !syncStatus.online || !syncStatus.cloudReady || offlineMode || !session}>
            {actionLabel}
          </Button>
          <Button variant="ghost" onClick={() => void syncStatus.refresh()}>
            Refresh Status
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
