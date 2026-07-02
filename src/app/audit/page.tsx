import { AppShell } from "@/components/layout/AppShell";
import { AuditScreen } from "@/features/audit/AuditScreen";

export default function AuditPage() {
  return (
    <AppShell title="Audit Logs" subtitle="Who changed what, when, and from which source.">
      <AuditScreen />
    </AppShell>
  );
}
