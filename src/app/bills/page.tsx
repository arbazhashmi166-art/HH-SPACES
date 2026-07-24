import { AppShell } from "@/components/layout/AppShell";
import { BillingHubScreen } from "@/features/billing/BillingHubScreen";

export default function BillsPage() {
  return (
    <AppShell title="Bills" subtitle="Client billing, supplier bill scanning, quotations, and extra work billing.">
      <BillingHubScreen />
    </AppShell>
  );
}
