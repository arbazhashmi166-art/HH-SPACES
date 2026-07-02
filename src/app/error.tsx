"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell title="Recovery" subtitle="The app caught a problem before it could break your data.">
      <Card>
        <h2>Something needs retry</h2>
        <p style={{ color: "var(--app-muted)", lineHeight: 1.45 }}>{error.message}</p>
        <Button onClick={reset}>Try Again</Button>
      </Card>
    </AppShell>
  );
}
