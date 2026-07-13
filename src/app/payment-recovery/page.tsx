import { AppShell } from "@/components/layout/AppShell";
import { PaymentRecoveryScreen } from "@/features/business-control/PaymentRecoveryScreen";

export default function PaymentRecoveryPage() {
  return (
    <AppShell title="Recovery" subtitle="Collect pending client payments with reminders and WhatsApp-ready follow-ups.">
      <PaymentRecoveryScreen />
    </AppShell>
  );
}
