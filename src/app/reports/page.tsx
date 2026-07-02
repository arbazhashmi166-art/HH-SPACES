import { AppShell } from "@/components/layout/AppShell";
import { ReportsScreen } from "@/features/reports/ReportsScreen";

export default function ReportsPage() {
  return (
    <AppShell title="Reports" subtitle="PDF, Excel, CSV, daily, weekly, monthly, site, labour, material, expense, and payment exports.">
      <ReportsScreen />
    </AppShell>
  );
}
