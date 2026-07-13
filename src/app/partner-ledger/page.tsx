import { AppShell } from "@/components/layout/AppShell";
import { PartnerLedgerScreen } from "@/features/business-control/PartnerLedgerScreen";

export default function PartnerLedgerPage() {
  return (
    <AppShell title="Partner Ledger" subtitle="Partner-wise company money taken, equal share comparison, and cash history.">
      <PartnerLedgerScreen />
    </AppShell>
  );
}
