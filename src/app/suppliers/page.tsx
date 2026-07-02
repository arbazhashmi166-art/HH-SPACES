import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function SuppliersPage() {
  return (
    <AppShell title="Suppliers" subtitle="Supplier contacts, material type, purchase history, and pending bill exposure.">
      <RecordModule resourceKey="suppliers" />
    </AppShell>
  );
}
