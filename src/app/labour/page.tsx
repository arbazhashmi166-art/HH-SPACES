import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function LabourPage() {
  return (
    <AppShell title="Labour" subtitle="Daily wage profiles, balances, advances, and assigned sites.">
      <RecordModule resourceKey="labour" />
    </AppShell>
  );
}
