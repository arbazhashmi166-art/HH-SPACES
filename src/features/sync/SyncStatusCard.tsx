import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useSyncStatus } from "./useSyncStatus";

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
        <Button variant="secondary" onClick={syncStatus.sync} disabled={syncStatus.syncing || !syncStatus.online || !syncStatus.cloudReady || offlineMode || !session}>
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}
