import { AppShell } from "@/components/layout/AppShell";
import { MarketRadarScreen } from "@/features/market/MarketRadarScreen";

export default function MarketRadarPage() {
  return (
    <AppShell title="Market Radar" subtitle="Latest construction-tech capabilities, power score, and upgrade playbook.">
      <MarketRadarScreen />
    </AppShell>
  );
}
