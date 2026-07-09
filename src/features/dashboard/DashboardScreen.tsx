"use client";

import { IonIcon } from "@ionic/react";
import { useRouter } from "next/navigation";
import { alertCircleOutline, calendarOutline, cubeOutline, receiptOutline, walletOutline } from "ionicons/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { quickActions } from "@/config/routes";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { businessIntelligence } from "@/utils/business-logic";
import { dashboardMetrics } from "@/utils/calc";
import { formatMoney } from "@/utils/format";
import styles from "./Dashboard.module.css";

export function DashboardScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const sites = useRecords("sites", company?.id);
  const labour = useRecords("labour", company?.id);
  const attendance = useRecords("attendance", company?.id);
  const materials = useRecords("materials", company?.id);
  const expenses = useRecords("expenses", company?.id);
  const payments = useRecords("client_payments", company?.id);
  const supplierPayments = useRecords("supplier_payments", company?.id);
  const progress = useRecords("progress_updates", company?.id);
  const activity = useRecords("activity_logs", company?.id);

  const metrics = dashboardMetrics({
    sites: sites.data || [],
    attendance: attendance.data || [],
    materials: materials.data || [],
    expenses: expenses.data || [],
    payments: payments.data || [],
    supplierPayments: supplierPayments.data || [],
    labour: labour.data || []
  });

  const intelligence = businessIntelligence({
    sites: sites.data || [],
    attendance: attendance.data || [],
    materials: materials.data || [],
    expenses: expenses.data || [],
    payments: payments.data || [],
    supplierPayments: supplierPayments.data || [],
    progress: progress.data || []
  });

  const progressAverage =
    (sites.data || []).length > 0
      ? Math.round((sites.data || []).reduce((total, site) => total + Number(site.progress_percent || 0), 0) / (sites.data || []).length)
      : 0;

  const alerts = [
    ...intelligence.alerts,
    metrics.pendingClientPayments > 0
      ? { title: "Client payment pending", message: `${formatMoney(metrics.pendingClientPayments)} receivable needs follow-up.`, severity: "warning" as const }
      : null,
    metrics.pendingSupplierPayments > 0
      ? { title: "Supplier payment pending", message: `${formatMoney(metrics.pendingSupplierPayments)} supplier balance is open.`, severity: "warning" as const }
      : null,
    metrics.labourAdvanceBalance > 0
      ? { title: "Labour balance pending", message: `${formatMoney(metrics.labourAdvanceBalance)} labour balance remains.`, severity: "warning" as const }
      : null,
    metrics.estimatedProfit < 0
      ? { title: "Monthly loss risk", message: `This month is at ${formatMoney(Math.abs(metrics.estimatedProfit))} negative margin.`, severity: "critical" as const }
      : null,
    (attendance.data || []).length === 0 ? { title: "Attendance missing", message: "No attendance entries are saved yet.", severity: "warning" as const } : null
  ].filter(Boolean).filter((alert, index, list) => list.findIndex((item) => item?.title === alert?.title) === index).slice(0, 8) as Array<{ title: string; message: string; severity: "info" | "warning" | "critical" }>;

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <p>Estimated monthly profit</p>
        <h2>{formatMoney(metrics.estimatedProfit)}</h2>
        <div className={styles.heroGrid}>
          <div className={styles.heroMini}>
            <span>Income</span>
            <strong>{formatMoney(metrics.monthlyIncome)}</strong>
          </div>
          <div className={styles.heroMini}>
            <span>Expense</span>
            <strong>{formatMoney(metrics.monthlyExpense)}</strong>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <Card className={styles.metric}>
          <span>Active Sites</span>
          <strong>{metrics.activeSites}</strong>
          <Badge tone="info">{progressAverage}% avg progress</Badge>
        </Card>
        <Card className={styles.metric}>
          <span>Today Labour</span>
          <strong>{formatMoney(metrics.todayLabourCost)}</strong>
          <Badge tone="neutral">Daily wages</Badge>
        </Card>
        <Card className={styles.metric}>
          <span>Today Material</span>
          <strong>{formatMoney(metrics.todayMaterialCost)}</strong>
          <Badge tone="neutral">Purchases</Badge>
        </Card>
        <Card className={styles.metric}>
          <span>Today Expense</span>
          <strong>{formatMoney(metrics.todayExpenses)}</strong>
          <Badge tone="neutral">Other costs</Badge>
        </Card>
      </div>

      <Card>
        <CardHeader title="Quick Actions" subtitle="Large touch targets for one-hand daily entry." />
        <div className={styles.quickGrid}>
          {quickActions.slice(0, 6).map((action) => (
            <button key={action.path} className={styles.quick} type="button" onClick={() => router.push(action.path)}>
              <IonIcon icon={action.icon} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Today Focus" subtitle="Prioritized actions from payment, budget, delay, attendance, and progress logic." action={<IonIcon icon={alertCircleOutline} />} />
        {intelligence.focusActions.length ? (
          <div className={styles.alertList}>
            {intelligence.focusActions.map((item) => (
              <div className={`${styles.alert} ${item.severity === "critical" ? styles.alertCritical : ""}`} key={`${item.title}-${item.siteId || ""}`}>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No focus action" description="When payment, attendance, progress, or budget needs attention, it will appear here first." />
        )}
      </Card>

      <Card>
        <CardHeader title="Smart Alerts" subtitle="Alerts are calculated from your saved records." action={<IonIcon icon={alertCircleOutline} />} />
        {alerts.length ? (
          <div className={styles.alertList}>
            {alerts.map((alert) => (
              <div className={`${styles.alert} ${alert.severity === "critical" ? styles.alertCritical : ""}`} key={alert.title}>
                <strong>{alert.title}</strong>
                <p>{alert.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No urgent alerts" description="The app will show payment, attendance, budget, sync, and progress alerts here." />
        )}
      </Card>

      <Card>
        <CardHeader title="Site Risk Engine" subtitle="Risk score combines budget, payment, delay, progress, and profit signals." />
        {intelligence.siteHealth.length ? (
          <div className={styles.timeline}>
            {intelligence.siteHealth.slice(0, 4).map((site) => (
              <div className={styles.riskItem} key={site.siteId}>
                <div>
                  <strong>{site.siteName}</strong>
                  <p>
                    Cost {formatMoney(site.totalCost)} | Received {formatMoney(site.received)} | Profit {formatMoney(site.profit)}
                  </p>
                </div>
                <Badge tone={site.riskLevel === "critical" ? "danger" : site.riskLevel === "warning" ? "warning" : "success"}>{site.riskScore}% risk</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No site risk yet" description="Add a site and daily entries to calculate budget, payment, and delay risk." />
        )}
      </Card>

      <Card>
        <CardHeader title="Business Health" subtitle="Site separation, source tagging, offline sync, and audit trail are active." />
        <div className={styles.grid}>
          <Badge tone="success">
            <IonIcon icon={walletOutline} /> Money guarded
          </Badge>
          <Badge tone="info">
            <IonIcon icon={calendarOutline} /> Attendance checked
          </Badge>
          <Badge tone="warning">
            <IonIcon icon={cubeOutline} /> Stock watched
          </Badge>
          <Badge tone="neutral">
            <IonIcon icon={receiptOutline} /> Receipts ready
          </Badge>
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent Activity" subtitle="Audit-friendly timeline from saved business actions." />
        {(activity.data || []).length ? (
          <div className={styles.timeline}>
            {(activity.data || []).slice(0, 6).map((item) => (
              <div className={styles.timelineItem} key={item.id}>
                <strong>{item.description}</strong>
                <p>{item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "Saved locally"}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No activity yet" description="Create a site, labour entry, material purchase, expense, or payment to build the timeline." />
        )}
      </Card>
    </section>
  );
}
