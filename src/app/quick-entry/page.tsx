import { AppShell } from "@/components/layout/AppShell";
import { QuickEntryScreen } from "@/features/quick-entry/QuickEntryScreen";

export default function QuickEntryPage() {
  return (
    <AppShell title="Quick Entry" subtitle="Fast daily add screen for site work, money, progress, and smart actions.">
      <QuickEntryScreen />
    </AppShell>
  );
}
