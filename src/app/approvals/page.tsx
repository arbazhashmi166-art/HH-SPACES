import { AppShell } from "@/components/layout/AppShell";
import { ApprovalCenterScreen } from "@/features/business-control/ApprovalCenterScreen";

export default function ApprovalsPage() {
  return (
    <AppShell title="Approvals" subtitle="Approve partner draws, extra work, supplier dues, expenses, and business decisions.">
      <ApprovalCenterScreen />
    </AppShell>
  );
}
