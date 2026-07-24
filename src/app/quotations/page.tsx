import { AppShell } from "@/components/layout/AppShell";
import { RateIntelligenceScreen } from "@/features/rates/RateIntelligenceScreen";

export default function QuotationsPage() {
  return (
    <AppShell title="Quotations" subtitle="Create customer quotation, BOQ, GST, profit and rate explanations from measurements.">
      <RateIntelligenceScreen />
    </AppShell>
  );
}
