import { AppShell } from "@/components/layout/AppShell";
import { BusinessBrainScreen } from "@/features/business-control/BusinessBrainScreen";

export default function BusinessBrainPage() {
  return (
    <AppShell title="Business Brain" subtitle="Smart control screen for cash, risk, approvals, partner money, and daily action.">
      <BusinessBrainScreen />
    </AppShell>
  );
}
