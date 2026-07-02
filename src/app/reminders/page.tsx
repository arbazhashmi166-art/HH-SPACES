import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function RemindersPage() {
  return (
    <AppShell title="Reminders" subtitle="Client follow-ups, supplier dues, labour balances, attendance, and custom tasks.">
      <RecordModule resourceKey="reminders" />
    </AppShell>
  );
}
