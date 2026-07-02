import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function AttendancePage() {
  return (
    <AppShell title="Attendance" subtitle="Present, absent, half day, overtime, and wage auto calculation.">
      <RecordModule resourceKey="attendance" />
    </AppShell>
  );
}
