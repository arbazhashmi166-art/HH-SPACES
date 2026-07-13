"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastMessage } from "@/components/ui/toast-message";
import { useAuth } from "@/lib/auth";
import { useCreateRecord, useRecords } from "@/lib/repository";
import type { ClientPayment, Site } from "@/types/domain";
import { formatMoney, todayIso } from "@/utils/format";
import styles from "./BusinessControl.module.css";

function daysSince(date?: string | null) {
  if (!date) return 0;
  const start = new Date(`${date}T00:00:00`).getTime();
  const end = new Date(`${todayIso()}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

function latestPayment(payments: ClientPayment[]) {
  return [...payments].sort((a, b) => String(b.payment_date || "").localeCompare(String(a.payment_date || "")))[0] || null;
}

export function PaymentRecoveryScreen() {
  const router = useRouter();
  const { company, user } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const sites = useRecords("sites", company?.id);
  const payments = useRecords("client_payments", company?.id);
  const createReminder = useCreateRecord("reminders", company?.id);

  const rows = useMemo(() => {
    const paymentRows = payments.data || [];
    return (sites.data || [])
      .map((site: Site) => {
        const sitePayments = paymentRows.filter((payment) => payment.site_id === site.id);
        const latest = latestPayment(sitePayments);
        const received = sitePayments.reduce((total, payment) => total + Number(payment.received_amount || 0), 0);
        const pending = latest ? Number(latest.pending_amount || 0) : Math.max(Number(site.budget || 0) - received, 0);
        const lastDate = latest?.payment_date || site.start_date;
        return {
          site,
          latest,
          received,
          pending,
          days: daysSince(lastDate),
          lastDate
        };
      })
      .filter((row) => row.pending > 0)
      .sort((a, b) => b.pending - a.pending || b.days - a.days);
  }, [payments.data, sites.data]);

  const totalPending = rows.reduce((total, row) => total + row.pending, 0);
  const overdueCount = rows.filter((row) => row.days >= 7).length;
  const topRow = rows[0] || null;

  const addReminder = async (row: (typeof rows)[number]) => {
    await createReminder.mutateAsync({
      values: {
        site_id: row.site.id,
        title: `Collect ${formatMoney(row.pending)} from ${row.site.client_name}`,
        description: `Payment pending for ${row.site.name}. Last payment/date signal: ${row.lastDate || "not available"}.`,
        due_date: todayIso(),
        status: "open",
        snoozed_until: null
      },
      userId: user?.id || null,
      source: "manual"
    });
    setToast("Payment reminder created");
  };

  const copyMessage = async (row: (typeof rows)[number]) => {
    const message = `Dear ${row.site.client_name}, payment of ${formatMoney(row.pending)} is pending for ${row.site.name}. Please confirm the payment schedule. - ${company?.name || "H&H SPACES"}`;
    try {
      await navigator.clipboard.writeText(message);
      setToast("WhatsApp reminder copied");
    } catch {
      setToast(message);
    }
  };

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>Payment Recovery Center</span>
        <h2>{formatMoney(totalPending)}</h2>
        <p>{rows.length} sites need follow-up. {overdueCount} are overdue by 7+ days.</p>
        <div className={styles.heroActions}>
          <Button onClick={() => router.push("/payments?add=1")}>Add Payment</Button>
          <Button variant="secondary" onClick={() => router.push("/reminders")}>Open Reminders</Button>
        </div>
      </div>

      <div className={styles.grid}>
        <Card className={styles.miniCard}>
          <span>Highest Pending</span>
          <strong>{topRow ? formatMoney(topRow.pending) : formatMoney(0)}</strong>
          <Badge tone={topRow ? "warning" : "success"}>{topRow?.site.name || "Clear"}</Badge>
        </Card>
        <Card className={styles.miniCard}>
          <span>Overdue Sites</span>
          <strong>{overdueCount}</strong>
          <Badge tone={overdueCount ? "danger" : "success"}>{overdueCount ? "Follow up" : "Controlled"}</Badge>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recovery List" subtitle="Site-wise pending payment sorted by highest amount first." />
        {rows.length ? (
          <div className={styles.recoveryList}>
            {rows.map((row) => (
              <div className={styles.recoveryItem} key={row.site.id}>
                <div className={styles.itemTop}>
                  <div>
                    <h3>{row.site.name}</h3>
                    <p>{row.site.client_name} {row.site.client_mobile ? `| ${row.site.client_mobile}` : ""}</p>
                  </div>
                  <Badge tone={row.days >= 14 ? "danger" : row.days >= 7 ? "warning" : "info"}>{row.days} days</Badge>
                </div>
                <div className={styles.grid}>
                  <div className={styles.miniCard}>
                    <span>Pending</span>
                    <strong>{formatMoney(row.pending)}</strong>
                  </div>
                  <div className={styles.miniCard}>
                    <span>Received</span>
                    <strong>{formatMoney(row.received)}</strong>
                  </div>
                </div>
                <div className={styles.buttonRow}>
                  <Button onClick={() => router.push(`/payments?add=1`)}>Record Payment</Button>
                  <Button variant="secondary" onClick={() => addReminder(row)} disabled={createReminder.isPending}>Remind</Button>
                </div>
                <div className={styles.buttonRow}>
                  <Button variant="ghost" onClick={() => copyMessage(row)}>Copy WhatsApp</Button>
                  <Button variant="ghost" onClick={() => router.push(`/sites`)}>Open Sites</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No pending payment" description="When client payment is pending, this screen becomes your recovery list." />
        )}
      </Card>

      <ToastMessage message={toast} duration={2400} onDismiss={() => setToast(null)} />
    </section>
  );
}
