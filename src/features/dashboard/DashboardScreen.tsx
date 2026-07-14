"use client";

import { IonIcon } from "@ionic/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  alertCircleOutline,
  barChartOutline,
  calendarOutline,
  cameraOutline,
  cashOutline,
  constructOutline,
  cubeOutline,
  receiptOutline,
  walletOutline
} from "ionicons/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { selectedSiteStorageKey, useUiStore } from "@/lib/ui-store";
import { automationEngine } from "@/utils/automation-engine";
import { businessIntelligence } from "@/utils/business-logic";
import { dashboardMetrics } from "@/utils/calc";
import { formatMoney, todayIso } from "@/utils/format";
import styles from "./Dashboard.module.css";

type SiteScoped = { site_id?: string | null };

function scopeRows<T extends SiteScoped>(rows: T[], siteId: string) {
  if (!siteId) return rows;
  return rows.filter((row) => row.site_id === siteId);
}

function withSite(path: string, siteId: string) {
  const currentSiteId = siteId || (typeof window === "undefined" ? "" : window.localStorage.getItem(selectedSiteStorageKey) || "");
  if (!currentSiteId || !path.includes("add=1") || path.includes("siteId=")) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}siteId=${encodeURIComponent(currentSiteId)}`;
}

export function DashboardScreen() {
  const router = useRouter();
  const { company, offlineMode, session } = useAuth();
  const selectedSiteId = useUiStore((state) => state.selectedSiteId);
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
  const today = todayIso();

  const selectedSite = useMemo(() => (sites.data || []).find((site) => site.id === selectedSiteId) || null, [selectedSiteId, sites.data]);
  const scopedSites = useMemo(() => (selectedSiteId ? (sites.data || []).filter((site) => site.id === selectedSiteId) : sites.data || []), [selectedSiteId, sites.data]);
  const scopedAttendance = useMemo(() => scopeRows(attendance.data || [], selectedSiteId), [attendance.data, selectedSiteId]);
  const scopedMaterials = useMemo(() => scopeRows(materials.data || [], selectedSiteId), [materials.data, selectedSiteId]);
  const scopedExpenses = useMemo(() => scopeRows(expenses.data || [], selectedSiteId), [expenses.data, selectedSiteId]);
  const scopedPayments = useMemo(() => scopeRows(payments.data || [], selectedSiteId), [payments.data, selectedSiteId]);
  const scopedSupplierPayments = useMemo(() => scopeRows(supplierPayments.data || [], selectedSiteId), [selectedSiteId, supplierPayments.data]);
  const scopedPartnerDraws = useMemo(() => scopeRows(partnerDraws.data || [], selectedSiteId), [partnerDraws.data, selectedSiteId]);
  const scopedProgress = useMemo(() => scopeRows(progress.data || [], selectedSiteId), [progress.data, selectedSiteId]);
  const scopedExtraWorks = useMemo(() => scopeRows(extraWorks.data || [], selectedSiteId), [extraWorks.data, selectedSiteId]);
  const scopedLabour = useMemo(
    () => (selectedSiteId ? (labour.data || []).filter((item) => item.site_id === selectedSiteId) : labour.data || []),
    [labour.data, selectedSiteId]
  );
  const scopedReminders = useMemo(() => scopeRows(reminders.data || [], selectedSiteId), [reminders.data, selectedSiteId]);

  const metrics = useMemo(
    () =>
      dashboardMetrics({
        sites: scopedSites,
        attendance: scopedAttendance,
        materials: scopedMaterials,
        expenses: scopedExpenses,
        payments: scopedPayments,
        supplierPayments: scopedSupplierPayments,
        labour: scopedLabour,
        extraWorks: scopedExtraWorks,
        partnerDraws: scopedPartnerDraws
      }),
    [scopedAttendance, scopedExpenses, scopedExtraWorks, scopedLabour, scopedMaterials, scopedPartnerDraws, scopedPayments, scopedSites, scopedSupplierPayments]
  );

  const intelligence = useMemo(
    () =>
      businessIntelligence({
        sites: scopedSites,
        attendance: scopedAttendance,
        materials: scopedMaterials,
        expenses: scopedExpenses,
        payments: scopedPayments,
        supplierPayments: scopedSupplierPayments,
        progress: scopedProgress,
        extraWorks: scopedExtraWorks
      }),
    [scopedAttendance, scopedExpenses, scopedExtraWorks, scopedMaterials, scopedPayments, scopedProgress, scopedSites, scopedSupplierPayments]
  );

  const automation = useMemo(
    () =>
      automationEngine({
        sites: scopedSites,
        labour: scopedLabour,
        attendance: scopedAttendance,
        materials: scopedMaterials,
        expenses: scopedExpenses,
        payments: scopedPayments,
        supplierPayments: scopedSupplierPayments,
        progress: scopedProgress,
        extraWorks: scopedExtraWorks,
        reminders: scopedReminders
      }),
    [scopedAttendance, scopedExpenses, scopedExtraWorks, scopedLabour, scopedMaterials, scopedPayments, scopedProgress, scopedReminders, scopedSites, scopedSupplierPayments]
  );

  const progressAverage = useMemo(
    () => (scopedSites.length ? Math.round(scopedSites.reduce((total, site) => total + Number(site.progress_percent || 0), 0) / scopedSites.length) : 0),
    [scopedSites]
  );
  const todayAttendance = scopedAttendance.filter((item) => item.date === today);
  const labourPresent = todayAttendance.reduce((total, item) => total + (item.status === "present" ? 1 : item.status === "half_day" ? 0.5 : 0), 0);
  const todayProgress = scopedProgress.filter((item) => item.date === today);
  const todaySpend = metrics.todayLabourCost + metrics.todayMaterialCost + metrics.todayExpenses;
  const pendingLocalRecords = [
    ...scopedSites,
    ...scopedAttendance,
    ...scopedMaterials,
    ...scopedExpenses,
    ...scopedPayments,
    ...scopedSupplierPayments,
    ...scopedExtraWorks,
    ...scopedProgress
  ].filter((item) => item.sync_status === "pending" || item.sync_status === "failed").length;
  const scopeLabel = selectedSite ? selectedSite.name : "All Sites";
  const scopeSub = selectedSite ? `${selectedSite.client_name || "Client"} - ${selectedSite.status}` : `${metrics.activeSites} active sites`;

  const attentionItems = [
    todayAttendance.length === 0
      ? { title: "Attendance missing", message: "Mark today's labour attendance before wages are missed.", route: "/attendance?add=1", severity: "warning" as const }
      : null,
    metrics.pendingClientPayments > 0
      ? { title: "Client payment pending", message: `${formatMoney(metrics.pendingClientPayments)} needs follow-up.`, route: "/payments", severity: "warning" as const }
      : null,
    todayProgress.length === 0
      ? { title: "Progress not updated", message: "Add today's work completed and remarks.", route: "/progress?add=1", severity: "warning" as const }
      : null,
    metrics.pendingSupplierPayments > 0
      ? { title: "Supplier payment pending", message: `${formatMoney(metrics.pendingSupplierPayments)} supplier balance is open.`, route: "/supplier-payments", severity: "warning" as const }
      : null,
    metrics.labourAdvanceBalance > 0
      ? { title: "Labour balance pending", message: `${formatMoney(metrics.labourAdvanceBalance)} labour balance remains.`, route: "/labour", severity: "warning" as const }
      : null,
    pendingLocalRecords > 0
      ? { title: "Cloud upload pending", message: `${pendingLocalRecords} entries are safe on this phone and waiting for cloud upload.`, route: "/settings#supabase-sync", severity: "warning" as const }
      : null,
    automation.actions[0]
      ? { title: automation.actions[0].title, message: automation.actions[0].description, route: automation.actions[0].route, severity: "info" as const }
      : null
  ].filter(Boolean).slice(0, 6) as Array<{ title: string; message: string; route: string; severity: "info" | "warning" }>;

  const quickEntries = [
    { label: "Mark Attendance", path: "/attendance?add=1", icon: calendarOutline },
    { label: "Add Expense", path: "/expenses?add=1", icon: receiptOutline },
    { label: "Add Material", path: "/materials?add=1", icon: cubeOutline },
    { label: "Add Progress", path: "/progress?add=1", icon: cameraOutline },
    { label: "Create Bill", path: "/bill-scanner", icon: constructOutline },
    { label: "Receive Payment", path: "/payments?add=1", icon: walletOutline }
  ];

  const go = (path: string) => router.push(withSite(path, selectedSiteId));

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <p>Good evening, Arbaz</p>
          <button type="button" onClick={() => go("/quick-entry")}>
            Add Today
          </button>
        </div>
        <h2>{scopeLabel}</h2>
        <p>
          {new Date(`${today}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })} - {scopeSub}
        </p>
        <div className={styles.heroGrid}>
          <div className={styles.heroMini}>
            <span>Save Status</span>
            <strong>{session && !offlineMode ? "Cloud Sync" : "Phone Save"}</strong>
          </div>
          <div className={styles.heroMini}>
            <span>Monthly Profit</span>
            <strong>{formatMoney(metrics.estimatedProfit)}</strong>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <Card className={styles.metric}>
          <span>Today's Expense</span>
          <strong>{formatMoney(todaySpend)}</strong>
          <Badge tone="neutral">Labour + material + other</Badge>
        </Card>
        <Card className={styles.metric}>
          <span>Labour Present</span>
          <strong>{labourPresent}</strong>
          <Badge tone={todayAttendance.length ? "success" : "warning"}>{todayAttendance.length ? `${todayAttendance.length} entries` : "Not marked"}</Badge>
        </Card>
        <Card className={styles.metric}>
          <span>Work Completed</span>
          <strong>{progressAverage}%</strong>
          <Badge tone={todayProgress.length ? "success" : "warning"}>{todayProgress.length ? "Updated today" : "Add update"}</Badge>
        </Card>
        <Card className={styles.metric}>
          <span>Client Due</span>
          <strong>{formatMoney(metrics.pendingClientPayments)}</strong>
          <Badge tone={metrics.pendingClientPayments > 0 ? "warning" : "success"}>{metrics.pendingClientPayments > 0 ? "Follow up" : "Clear"}</Badge>
        </Card>
      </div>

      <Card>
        <CardHeader title="Requires Attention" subtitle="Only the most important actions for today." action={<IonIcon icon={alertCircleOutline} />} />
        {attentionItems.length ? (
          <div className={styles.alertList}>
            {attentionItems.map((item) => (
              <button className={`${styles.alert} ${item.severity === "warning" ? styles.alertWarning : ""}`} key={item.title} type="button" onClick={() => go(item.route)}>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing urgent right now" description="Payment, attendance, progress, sync, and labour alerts will appear here when they need action." />
        )}
      </Card>

      <Card>
        <CardHeader title="Quick Actions" subtitle="Big one-hand buttons for daily work." />
        <div className={styles.quickGrid}>
          {quickEntries.map((action) => (
            <button key={action.path} className={styles.quick} type="button" onClick={() => go(action.path)}>
              <IonIcon icon={action.icon} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className={styles.liveRibbon}>
        <button type="button" onClick={() => go("/sites")}>
          <span>Active Sites</span>
          <strong>{metrics.activeSites}</strong>
        </button>
        <button type="button" onClick={() => go("/payments")}>
          <span>Pending</span>
          <strong>{formatMoney(metrics.pendingClientPayments)}</strong>
        </button>
        <button type="button" onClick={() => go("/extra-works")}>
          <span>Unbilled Extra</span>
          <strong>{formatMoney(metrics.unbilledExtraWorks)}</strong>
        </button>
        <button type="button" onClick={() => go("/partner-ledger")}>
          <span>Partner Draws</span>
          <strong>{formatMoney(metrics.partnerDrawsTotal)}</strong>
        </button>
      </div>

      <Card>
        <CardHeader title="Money Summary" subtitle="Monthly income, cost, profit, and payables for the selected site scope." />
        <div className={styles.grid}>
          <div className={styles.miniPanel}>
            <span>Income</span>
            <strong>{formatMoney(metrics.monthlyIncome)}</strong>
          </div>
          <div className={styles.miniPanel}>
            <span>Expense</span>
            <strong>{formatMoney(metrics.monthlyExpense)}</strong>
          </div>
          <div className={styles.miniPanel}>
            <span>Supplier Due</span>
            <strong>{formatMoney(metrics.pendingSupplierPayments)}</strong>
          </div>
          <div className={styles.miniPanel}>
            <span>Profit/Loss</span>
            <strong>{formatMoney(metrics.estimatedProfit)}</strong>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Advanced Tools" subtitle="Useful when needed, hidden below daily operations." />
        <div className={styles.commandGrid}>
          <button className={styles.commandTile} type="button" onClick={() => go("/reports")}>
            <span>Reports</span>
            <strong>PDF / Excel</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => go("/payment-recovery")}>
            <span>Recovery</span>
            <strong>Collect Money</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => go("/daily-closing")}>
            <span>Daily Report</span>
            <strong>End Day</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => go("/ai")}>
            <span>Ask AI</span>
            <strong>Smart Drafts</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => go("/cash-flow")}>
            <span>Cash Flow</span>
            <strong>Forecast</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => go("/data-health")}>
            <span>Data Health</span>
            <strong>{intelligence.siteHealth.filter((site) => site.riskLevel !== "info").length} Risks</strong>
          </button>
        </div>
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
            <IonIcon icon={cashOutline} /> Partner ledger
          </Badge>
          <Badge tone="neutral">
            <IonIcon icon={barChartOutline} /> Reports ready
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
                <p>{item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "Saved on phone"}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No activity yet" description="Create a site, attendance, material, expense, payment, or progress entry to build the timeline." />
        )}
      </Card>
    </section>
  );
}
