import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function MaterialsPage() {
  return (
    <AppShell title="Materials" subtitle="Purchases, quantities, rates, supplier bills, and payment status.">
      <RecordModule resourceKey="materials" />
    </AppShell>
  );
}
