import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function PartnerDrawsPage() {
  return (
    <AppShell title="Partner Draws" subtitle="Track company money taken by each partner for profit share, emergency, advance, salary, or reimbursement.">
      <RecordModule resourceKey="partner_draws" />
    </AppShell>
  );
}
