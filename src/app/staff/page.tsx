import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function StaffPage() {
  return (
    <AppShell title="Staff" subtitle="Admin, staff, viewer roles, and company-level permissions.">
      <RecordModule resourceKey="company_members" />
    </AppShell>
  );
}
