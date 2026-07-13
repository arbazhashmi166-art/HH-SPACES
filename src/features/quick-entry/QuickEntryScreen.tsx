"use client";

import { IonIcon } from "@ionic/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { quickActionGroups } from "@/config/routes";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { automationEngine } from "@/utils/automation-engine";
import { dashboardMetrics } from "@/utils/calc";
import { formatMoney, todayIso } from "@/utils/format";
import styles from "./QuickEntry.module.css";

function statusTone(done: boolean) {
  return done ? "success" : "warning";
}

export function QuickEntryScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const today = todayIso();

  const sites = useRecords("sites", company?.id);
  const labour = useRecords("labour", company?.id);
  const attendance = useRecords("attendance", company?.id);
  const materials = useRecords("materials", company?.id);
  const expenses = useRecords("expenses", company?.id);
  const payments = useRecords("client_payments", company?.id);
  const supplierPayments = useRecords("supplier_payments", company?.id);
  const partnerDraws = useRecords("partner_draws", company?.id);
  const progress = useRecords("progress_updates", company?.id);
  const extraWorks = useRecords("extra_works", company?.id);
  const reminders = useRecords("reminders", company?.id);

  const metrics = useMemo(
    () =>
      dashboardMetrics({
        sites: sites.data || [],
        attendance: attendance.data || [],
        materials: materials.data || [],
        expenses: expenses.data || [],
        payments: payments.data || [],
        supplierPayments: supplierPayments.data || [],
        labour: labour.data || [],
        extraWorks: extraWorks.data || [],
        partnerDraws: partnerDraws.data || []
      }),
    [attendance.data, expenses.data, extraWorks.data, labour.data, materials.data, partnerDraws.data, payments.data, sites.data, supplierPayments.data]
  );

  const engine = useMemo(
    () =>
      automationEngine({
        sites: sites.data || [],
        labour: labour.data || [],
        attendance: attendance.data || [],
        materials: materials.data || [],
        expenses: expenses.data || [],
        payments: payments.data || [],
        supplierPayments: supplierPayments.data || [],
        progress: progress.data || [],
        extraWorks: extraWorks.data || [],
        reminders: reminders.data || []
      }),
    [attendance.data, expenses.data, extraWorks.data, labour.data, materials.data, payments.data, progress.data, reminders.data, sites.data, supplierPayments.data]
  );

  const todayStatus = [
    {
      label: "Attendance",
      done: (attendance.data || []).some((item) => item.date === today),
      path: "/attendance?add=1"
    },
    {
      label: "Material",
      done: (materials.data || []).some((item) => item.date === today),
      path: "/materials?add=1"
    },
    {
      label: "Expense",
      done: (expenses.data || []).some((item) => item.date === today),
      path: "/expenses?add=1"
    },
    {
      label: "Progress",
      done: (progress.data || []).some((item) => item.date === today),
      path: "/progress?add=1"
    }
  ];

  const doneCount = todayStatus.filter((item) => item.done).length;

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>Quick Entry</span>
        <h2>{doneCount}/4</h2>
        <p>Today’s main site entries completed. Add common daily records in one or two taps.</p>
        <div className={styles.heroActions}>
          <Button onClick={() => router.push("/attendance?add=1")}>Start Attendance</Button>
          <Button variant="secondary" onClick={() => router.push("/bill-scanner")}>Scan Bill</Button>
        </div>
      </div>

      <div className={styles.statusGrid}>
        {todayStatus.map((item) => (
          <button className={styles.statusCard} type="button" key={item.label} onClick={() => router.push(item.path)}>
            <span>{item.label}</span>
            <strong>{item.done ? "Done" : "Add"}</strong>
            <Badge tone={statusTone(item.done)}>{item.done ? "Saved" : "Open"}</Badge>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title="Fast Money View" subtitle="The three numbers you usually need before taking action." />
        <div className={styles.moneyGrid}>
          <button type="button" onClick={() => router.push("/payment-recovery")}>
            <span>Client Pending</span>
            <strong>{formatMoney(metrics.pendingClientPayments)}</strong>
          </button>
          <button type="button" onClick={() => router.push("/supplier-payments")}>
            <span>Supplier Pending</span>
            <strong>{formatMoney(metrics.pendingSupplierPayments)}</strong>
          </button>
          <button type="button" onClick={() => router.push("/partner-ledger")}>
            <span>Partner Draws</span>
            <strong>{formatMoney(metrics.partnerDrawsTotal)}</strong>
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Suggested Next" subtitle="Calculated from missing entries, pending money, site risk, and reminders." />
        {engine.actions.length ? (
          <div className={styles.suggestionList}>
            {engine.actions.slice(0, 4).map((action) => (
              <button className={styles.suggestion} type="button" key={action.id} onClick={() => router.push(action.route)}>
                <span>{action.category}</span>
                <strong>{action.title}</strong>
                <p>{action.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No urgent action" description="Your quick suggestions will appear here when something needs attention." />
        )}
      </Card>

      {quickActionGroups.map((group) => (
        <Card key={group.title}>
          <CardHeader title={group.title} subtitle="Tap any card to open the correct entry screen." />
          <div className={styles.quickGrid}>
            {group.actions.map((action) => (
              <button className={styles.quickCard} type="button" key={action.path} onClick={() => router.push(action.path)}>
                <IonIcon icon={action.icon} />
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.helper}</small>
                </span>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </section>
  );
}
