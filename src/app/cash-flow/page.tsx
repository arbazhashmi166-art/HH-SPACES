import { AppShell } from "@/components/layout/AppShell";
import { CashFlowForecastScreen } from "@/features/business-control/CashFlowForecastScreen";

export default function CashFlowPage() {
  return (
    <AppShell title="Cash Flow" subtitle="7, 15, and 30 day cash pressure forecast from real entries.">
      <CashFlowForecastScreen />
    </AppShell>
  );
}
