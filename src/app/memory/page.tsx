import { AppShell } from "@/components/layout/AppShell";
import { MemoryScreen } from "@/features/memory/MemoryScreen";

export default function MemoryPage() {
  return (
    <AppShell title="Smart Memory" subtitle="Long-term company memory for sites, clients, suppliers, labour, payments, and AI.">
      <MemoryScreen />
    </AppShell>
  );
}
