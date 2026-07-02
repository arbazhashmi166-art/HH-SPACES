"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { toTitle } from "@/utils/format";

export function AuditScreen() {
  const { company } = useAuth();
  const audit = useRecords("audit_logs", company?.id);
  const activity = useRecords("activity_logs", company?.id);
  const rows = [...(audit.data || []), ...(activity.data || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <Card>
        <CardHeader title="Audit Logs" subtitle="Tracks who created, updated, archived, synced, or confirmed AI business records." />
      </Card>
      {rows.length ? (
        rows.map((row) => (
          <Card key={row.id}>
            <CardHeader
              title={"description" in row ? row.description : `${row.action} ${row.entity_table}`}
              subtitle={row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "Local time"}
              action={<Badge tone="neutral">{toTitle(row.source)}</Badge>}
            />
          </Card>
        ))
      ) : (
        <EmptyState title="No audit logs yet" description="Create or update entries to build a reliable activity and audit trail." />
      )}
    </section>
  );
}
