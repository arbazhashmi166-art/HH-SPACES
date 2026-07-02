import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFoundPage() {
  return (
    <AppShell title="Not Found" subtitle="The screen you opened is not available.">
      <EmptyState title="Screen not found" description="Use the bottom navigation or search to open the correct module." />
    </AppShell>
  );
}
