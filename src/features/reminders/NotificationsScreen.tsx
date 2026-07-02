"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useRecords, useUpdateRecord } from "@/lib/repository";

export function NotificationsScreen() {
  const { company, user } = useAuth();
  const notifications = useRecords("notifications", company?.id);
  const update = useUpdateRecord("notifications", company?.id);
  const open = (notifications.data || []).filter((item) => !item.read_at);

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <Card>
        <CardHeader title="Notifications" subtitle="In-app alerts for low stock, pending payments, attendance, sync, and data health." />
      </Card>
      {open.length ? (
        open.map((item) => (
          <Card key={item.id}>
            <CardHeader title={item.title} subtitle={item.message} action={<Badge tone={item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : "info"}>{item.severity}</Badge>} />
            <Button
              variant="secondary"
              onClick={() => update.mutate({ id: item.id, values: { read_at: new Date().toISOString() }, userId: user?.id || null })}
            >
              Mark Read
            </Button>
          </Card>
        ))
      ) : (
        <EmptyState title="No unread notifications" description="Smart alerts and reminders will appear here when records need attention." />
      )}
    </section>
  );
}
