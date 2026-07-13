import { AppShell } from "@/components/layout/AppShell";
import { DailyClosingScreen } from "@/features/business-control/DailyClosingScreen";

export default function DailyClosingPage() {
  return (
    <AppShell title="Daily Closing" subtitle="End-of-day checklist, auto summary, and saved daily report.">
      <DailyClosingScreen />
    </AppShell>
  );
}
