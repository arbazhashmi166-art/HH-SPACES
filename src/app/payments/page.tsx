import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function PaymentsPage() {
  return (
    <AppShell title="Finance" subtitle="Client payments, received amount, pending balance, and follow-up history.">
      <RecordModule resourceKey="client_payments" />
    </AppShell>
  );
}
