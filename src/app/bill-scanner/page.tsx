import { AppShell } from "@/components/layout/AppShell";
import { BillScannerScreen } from "@/features/business-control/BillScannerScreen";

export default function BillScannerPage() {
  return (
    <AppShell title="Bill Scanner" subtitle="Scan supplier bills and save verified material or expense entries.">
      <BillScannerScreen />
    </AppShell>
  );
}
