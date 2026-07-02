import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function ExpensesPage() {
  return (
    <AppShell title="Expenses" subtitle="Daily expenses, payment modes, receipts, and site-wise cost control.">
      <RecordModule resourceKey="expenses" />
    </AppShell>
  );
}
