import { AppShell } from "@/components/layout/AppShell";
import { RateIntelligenceScreen } from "@/features/rates/RateIntelligenceScreen";

export default function RateAnalyzerPage() {
  return (
    <AppShell title="Rate Analyzer" subtitle="Construction rate intelligence, BOQ calculator, quotation helper, and profit analyzer.">
      <RateIntelligenceScreen />
    </AppShell>
  );
}
