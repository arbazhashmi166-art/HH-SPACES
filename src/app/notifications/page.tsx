import { AppShell } from "@/components/layout/AppShell";
import { NotificationsScreen } from "@/features/reminders/NotificationsScreen";

export default function NotificationsPage() {
  return (
    <AppShell title="Notifications" subtitle="Smart in-app alerts and read status.">
      <NotificationsScreen />
    </AppShell>
  );
}
