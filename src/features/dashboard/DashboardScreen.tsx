"use client";

import { IonIcon } from "@ionic/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { alertCircleOutline, calendarOutline, cubeOutline, receiptOutline, walletOutline } from "ionicons/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { quickActions } from "@/config/routes";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { automationEngine } from "@/utils/automation-engine";
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
  const partnerDraws = useRecords("partner_draws", company?.id);
  const progress = useRecords("progress_updates", company?.id);
  const extraWorks = useRecords("extra_works", company?.id);
  const reminders = useRecords("reminders", company?.id);
  const activity = useRecords("activity_logs", company?.id);

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

  const intelligence = useMemo(
    () =>
      businessIntelligence({
        sites: sites.data || [],
        attendance: attendance.data || [],
        materials: materials.data || [],
        expenses: expenses.data || [],
        payments: payments.data || [],
        supplierPayments: supplierPayments.data || [],
        progress: progress.data || [],
        extraWorks: extraWorks.data || []
      }),
    [attendance.data, expenses.data, extraWorks.data, materials.data, payments.data, progress.data, sites.data, supplierPayments.data]
  );

  const automation = useMemo(
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
  const topAutomationAction = automation.actions[0];

  const progressAverage = useMemo(
    () =>
      (sites.data || []).length > 0
        ? Math.round((sites.data || []).reduce((total, site) => total + Number(site.progress_percent || 0), 0) / (sites.data || []).length)
        : 0,
    [sites.data]
  );

  const alerts = useMemo(
    () =>
      [
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
      ]
        .filter(Boolean)
        .filter((alert, index, list) => list.findIndex((item) => item?.title === alert?.title) === index)
        .slice(0, 8) as Array<{ title: string; message: string; severity: "info" | "warning" | "critical" }>,
    [attendance.data, intelligence.alerts, metrics.estimatedProfit, metrics.labourAdvanceBalance, metrics.pendingClientPayments, metrics.pendingSupplierPayments]
  );

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <p>Estimated monthly profit</p>
          <button type="button" onClick={() => router.push("/market-radar")}>
            Market Radar
          </button>
        </div>
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

      <div className={styles.commandCenter}>
        <button className={styles.commandLead} type="button" onClick={() => router.push("/automations")}>
          <span>AI-Native Command Center</span>
          <strong>{automation.operatingScore}/100 Business Control</strong>
          <p>Cashflow, site risk, reminders, daily checklist, and next best action in one place.</p>
        </button>
        <div className={styles.commandGrid}>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/quick-entry")}>
            <span>Quick Entry</span>
            <strong>One Tap Add</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/reports")}>
            <span>Reports</span>
            <strong>PDF / Excel</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/payment-recovery")}>
            <span>Recovery</span>
            <strong>Collect Money</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/business-brain")}>
            <span>Brain</span>
            <strong>Control Room</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/cash-flow")}>
            <span>Cash Flow</span>
            <strong>Forecast</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/approval-center")}>
            <span>Approvals</span>
            <strong>Decisions</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/bill-scanner")}>
            <span>Bill Scan</span>
            <strong>OCR Entry</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/ai")}>
            <span>Ask AI</span>
            <strong>Smart Drafts</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/settings#supabase-sync")}>
            <span>Cloud</span>
            <strong>Sync Status</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/attendance?add=1")}>
            <span>Daily</span>
            <strong>Fast Entry</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/daily-closing")}>
            <span>Closing</span>
            <strong>End Day</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/extra-works?add=1")}>
            <span>Extra Work</span>
            <strong>Capture Value</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => router.push("/partner-draws?add=1")}>
            <span>Partner Draw</span>
            <strong>Money Taken</strong>
          </button>
        </div>
      </div>

      <div className={styles.liveRibbon}>
        <button type="button" onClick={() => router.push("/automations")}>
          <span>Autopilot</span>
          <strong>{automation.actions.length} actions</strong>
        </button>
        <button type="button" onClick={() => router.push("/data-health")}>
          <span>Risk</span>
          <strong>{intelligence.siteHealth.filter((site) => site.riskLevel !== "info").length} sites</strong>
        </button>
        <button type="button" onClick={() => router.push("/payments")}>
          <span>Pending</span>
          <strong>{formatMoney(metrics.pendingClientPayments)}</strong>
        </button>
        <button type="button" onClick={() => router.push("/extra-works")}>
          <span>Unbilled Extra</span>
          <strong>{formatMoney(metrics.unbilledExtraWorks)}</strong>
        </button>
        <button type="button" onClick={() => router.push("/partner-draws")}>
          <span>Partner Draws</span>
          <strong>{formatMoney(metrics.partnerDrawsTotal)}</strong>
        </button>
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
        <Card className={styles.metric}>
          <span>Approved Extra</span>
          <strong>{formatMoney(metrics.approvedExtraWorks)}</strong>
          <Badge tone={metrics.unbilledExtraWorks > 0 ? "warning" : "success"}>{metrics.unbilledExtraWorks > 0 ? "Unbilled" : "Controlled"}</Badge>
        </Card>
        <Card className={styles.metric}>
          <span>Partner Draws</span>
          <strong>{formatMoney(metrics.partnerDrawsTotal)}</strong>
          <Badge tone="info">Company cash taken</Badge>
        </Card>
      </div>

      <Card>
        <CardHeader title="Partner Money Taken" subtitle="Total company withdrawals by partner, including profit share, emergency, advance, salary, and reimbursement." />
        {(partnerDraws.data || []).length ? (
          <div className={styles.timeline}>
            {Object.entries(
              (partnerDraws.data || []).reduce<Record<string, number>>((totals, item) => {
                totals[item.partner_name] = (totals[item.partner_name] || 0) + Number(item.amount || 0);
                return totals;
              }, {})
            )
              .sort((a, b) => b[1] - a[1])
              .map(([name, amount]) => (
                <div className={styles.riskItem} key={name}>
                  <div>
                    <strong>{name}</strong>
                    <p>Company money taken till now</p>
                  </div>
                  <Badge tone="info">{formatMoney(amount)}</Badge>
                </div>
              ))}
          </div>
        ) : (
          <EmptyState title="No partner draws yet" description="When any partner takes company money, record it here so the final sharing stays clear." />
        )}
        <div className={styles.autopilotAction}>
          <Button onClick={() => router.push("/partner-ledger")}>Open Partner Ledger</Button>
          <Button variant="secondary" onClick={() => router.push("/partner-draws?add=1")}>Add Money Taken</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Business Autopilot" subtitle="Automatic operating score, cashflow pressure, and next best action." />
        <div className={styles.autopilot}>
          <div className={styles.scoreBox}>
            <span>Score</span>
            <strong>{automation.operatingScore}/100</strong>
            <p>{automation.scoreLabel}</p>
          </div>
          <div className={styles.cashBox}>
            <span>Cash Pressure</span>
            <strong>{automation.cashflow.pressure}</strong>
            <p>Client pending {formatMoney(automation.cashflow.pendingClient)}</p>
            <p>Payables {formatMoney(automation.cashflow.supplierExposure + automation.cashflow.labourBalance)}</p>
            <p>Unbilled extra {formatMoney(automation.cashflow.unbilledExtraWorks)}</p>
          </div>
        </div>
        <div className={styles.autopilotAction}>
          {topAutomationAction ? (
            <>
              <div>
                <strong>{topAutomationAction.title}</strong>
                <p>{topAutomationAction.description}</p>
              </div>
              <Button onClick={() => router.push(topAutomationAction.route)}>{topAutomationAction.primaryAction}</Button>
            </>
          ) : (
            <>
              <div>
                <strong>No urgent action</strong>
                <p>Open automations for cashflow radar, daily checklist, and all active rules.</p>
              </div>
              <Button onClick={() => router.push("/automations")}>Open Auto</Button>
            </>
          )}
        </div>
      </Card>

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
                    {site.unbilledExtraWork ? ` | Extra unbilled ${formatMoney(site.unbilledExtraWork)}` : ""}
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
