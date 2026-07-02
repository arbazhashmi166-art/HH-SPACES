import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function ProgressPage() {
  return (
    <AppShell title="Progress" subtitle="Daily progress entries, timeline, delay notes, and site percentage tracking.">
      <RecordModule resourceKey="progress_updates" />
    </AppShell>
  );
}
