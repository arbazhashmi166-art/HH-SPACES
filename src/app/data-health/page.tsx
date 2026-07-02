import { AppShell } from "@/components/layout/AppShell";
import { DataHealthScreen } from "@/features/data-health/DataHealthScreen";

export default function DataHealthPage() {
  return (
    <AppShell title="Data Health" subtitle="Find duplicate, missing, risky, or suspicious business records.">
      <DataHealthScreen />
    </AppShell>
  );
}
