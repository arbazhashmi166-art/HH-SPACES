"use client";

import type { ReactNode } from "react";
import { AppShell as ClientShell } from "./AppShellClient";

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <ClientShell title={title} subtitle={subtitle}>
      {children}
    </ClientShell>
  );
}
