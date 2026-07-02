import { AppShell } from "@/components/layout/AppShell";
import { AiAssistant } from "@/features/ai/AiAssistant";

export default function AiPage() {
  return (
    <AppShell title="Ask AI" subtitle="AI drafts and business answers with confirmation before saving.">
      <AiAssistant />
    </AppShell>
  );
}
