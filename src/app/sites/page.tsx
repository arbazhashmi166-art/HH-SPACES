import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function SitesPage() {
  return (
    <AppShell title="Sites" subtitle="Site-wise contracts, clients, budget, progress, and profit control.">
      <RecordModule resourceKey="sites" />
    </AppShell>
  );
}
