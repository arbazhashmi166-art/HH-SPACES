import { AppShell } from "@/components/layout/AppShell";
import { RecordModule } from "@/features/records/RecordModule";

export default function ExtraWorksPage() {
  return (
    <AppShell title="Extra Works" subtitle="Track client-approved change orders, amount increases, billing status, and unbilled variation work.">
      <RecordModule resourceKey="extra_works" />
    </AppShell>
  );
}
