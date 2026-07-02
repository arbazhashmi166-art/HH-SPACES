import { AppShell } from "@/components/layout/AppShell";
import { SettingsScreen } from "@/features/settings/SettingsScreen";

export default function SettingsPage() {
  return (
    <AppShell title="More" subtitle="Settings, modules, roles, theme, backup, sync, and company details.">
      <SettingsScreen />
    </AppShell>
  );
}
