import { AppShell } from "@/components/layout/AppShell";
import { DashboardScreen } from "@/features/dashboard/DashboardScreen";

export default function DashboardPage() {
  return (
    <AppShell title="Home" subtitle="Live construction business control from your phone.">
      <DashboardScreen />
    </AppShell>
  );
}
