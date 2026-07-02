import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function SupplierPaymentsPage() {
  return (
    <AppShell title="Supplier Payments" subtitle="Track paid amount, pending amount, bill references, and supplier ledger.">
      <RecordModule resourceKey="supplier_payments" />
    </AppShell>
  );
}
