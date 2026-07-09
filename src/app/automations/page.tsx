import { AppShell } from "@/components/layout/AppShell";
import { AutomationScreen } from "@/features/automation/AutomationScreen";

export default function AutomationsPage() {
  return (
    <AppShell title="Automations" subtitle="Business autopilot, cashflow radar, daily checklist, and smart next actions.">
      <AutomationScreen />
    </AppShell>
  );
}
