"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ClientShell = dynamic(() => import("./AppShellClient").then((mod) => mod.AppShell), {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100dvh", padding: 16, background: "var(--app-bg)" }}>
      <Skeleton style={{ height: 90, marginBottom: 14 }} />
      <Skeleton style={{ height: 180, marginBottom: 14 }} />
      <Skeleton style={{ height: 120 }} />
    </main>
  )
});

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <ClientShell title={title} subtitle={subtitle}>
      {children}
    </ClientShell>
  );
}
