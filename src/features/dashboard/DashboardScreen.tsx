"use client";

import { IonIcon } from "@ionic/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  alertCircleOutline,
  calendarOutline,
  cameraOutline,
  constructOutline,
  cubeOutline,
  receiptOutline,
  walletOutline
} from "ionicons/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useSyncStatus } from "@/features/sync/useSyncStatus";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { selectedSiteStorageKey, useUiStore } from "@/lib/ui-store";
import { automationEngine } from "@/utils/automation-engine";
import { businessIntelligence } from "@/utils/business-logic";
import { dashboardMetrics, sumBy } from "@/utils/calc";
import { formatMoney } from "@/utils/format";
import {
  attendanceBreakdown,
  getDashboardDateRange,
  getDashboardGreeting,
  isWithinDateRange,
  type DashboardDatePreset
} from "./dashboard-utils";
import styles from "./Dashboard.module.css";

type SiteScoped = { site_id?: string | null };
type AttentionItem = { title: string; message: string; route: string; severity: "critical" | "warning" | "info"; action: string };

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

function lastUpdatedLabel(value: string | null) {
  if (!value) return "No update in selected period";
  return `Last updated ${new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

function severityRank(item: AttentionItem) {
  return item.severity === "critical" ? 0 : item.severity === "warning" ? 1 : 2;
}

function isAttentionItem(item: AttentionItem | null): item is AttentionItem {
  return Boolean(item);
}

export function DashboardScreen() {
  const router = useRouter();
  const { company, offlineMode, session, profile, cloudLoginIssue } = useAuth();
  const selectedSiteId = useUiStore((state) => state.selectedSiteId);
  const [datePreset, setDatePreset] = useState<DashboardDatePreset>("today");
  const dateRange = useMemo(() => getDashboardDateRange(datePreset), [datePreset]);
  const greeting = useMemo(
    () => getDashboardGreeting(profile?.full_name, session?.user?.user_metadata?.full_name),
    [profile?.full_name, session?.user?.user_metadata?.full_name]
  );

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
  const syncStatus = useSyncStatus({
    companyId: company?.id,
    offlineMode,
    hasSession: Boolean(session),
    cloudLoginIssue
  });

  const dashboardQueries = [
    sites,
    labour,
    attendance,
    materials,
    expenses,
    payments,
    supplierPayments,
    partnerDraws,
    progress,
    extraWorks,
    reminders,
    activity
  ];
  const dashboardLoading = dashboardQueries.some((query) => query.isLoading);
  const dashboardError = dashboardQueries.some((query) => query.isError);
  const retryDashboard = () => {
    void Promise.all(dashboardQueries.map((query) => query.refetch()));
  };

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
  const scopedActivity = useMemo(() => scopeRows(activity.data || [], selectedSiteId), [activity.data, selectedSiteId]);

  const periodAttendance = useMemo(() => scopedAttendance.filter((item) => isWithinDateRange(item.date, dateRange)), [dateRange, scopedAttendance]);
  const periodMaterials = useMemo(() => scopedMaterials.filter((item) => isWithinDateRange(item.date, dateRange)), [dateRange, scopedMaterials]);
  const periodExpenses = useMemo(() => scopedExpenses.filter((item) => isWithinDateRange(item.date, dateRange)), [dateRange, scopedExpenses]);
  const periodProgress = useMemo(() => scopedProgress.filter((item) => isWithinDateRange(item.date, dateRange)), [dateRange, scopedProgress]);

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
  const attendanceSummary = useMemo(() => attendanceBreakdown(periodAttendance), [periodAttendance]);
  const periodLabourCost = useMemo(() => sumBy(periodAttendance, (item) => item.wage_amount), [periodAttendance]);
  const periodMaterialCost = useMemo(() => sumBy(periodMaterials, (item) => item.total), [periodMaterials]);
  const periodExpenseCost = useMemo(() => sumBy(periodExpenses, (item) => item.amount), [periodExpenses]);
  const periodSpend = periodLabourCost + periodMaterialCost + periodExpenseCost;
  const progressLastUpdated = periodProgress.reduce<string | null>((latest, item) => (!latest || item.updated_at > latest ? item.updated_at : latest), null);
  const contractValue = useMemo(() => sumBy(scopedSites, (site) => site.budget), [scopedSites]);
  const recordedCost = useMemo(
    () => sumBy(scopedMaterials, (item) => item.total) + sumBy(scopedAttendance, (item) => item.wage_amount) + sumBy(scopedExpenses, (item) => item.amount),
    [scopedAttendance, scopedExpenses, scopedMaterials]
  );
  const costConsumed = contractValue > 0 ? Math.round((recordedCost / contractValue) * 100) : 0;
  const costVariance = costConsumed - progressAverage;
  const scopeLabel = selectedSite ? selectedSite.name : "All Sites";
  const scopeSub = selectedSite ? `${selectedSite.client_name || "Client"} - ${selectedSite.status}` : `${metrics.activeSites} active sites`;

  const attentionItems = [
    periodAttendance.length === 0
      ? {
          title: "Attendance missing",
          message: `${dateRange.label} labour attendance is not marked for ${scopeLabel}.`,
          route: "/attendance?add=1",
          severity: "warning" as const,
          action: "Mark attendance"
        }
      : null,
    metrics.pendingClientPayments > 0
      ? {
          title: "Client receivable open",
          message: `${formatMoney(metrics.pendingClientPayments)} outstanding from recorded client payments.`,
          route: "/payments",
          severity: "warning" as const,
          action: "Open payments"
        }
      : null,
    periodProgress.length === 0
      ? {
          title: "Progress not updated",
          message: `No progress entry found for ${dateRange.label.toLowerCase()} in ${scopeLabel}.`,
          route: "/progress?add=1",
          severity: "warning" as const,
          action: "Add progress"
        }
      : null,
    metrics.pendingSupplierPayments > 0
      ? {
          title: "Supplier payable open",
          message: `${formatMoney(metrics.pendingSupplierPayments)} supplier balance is recorded as pending.`,
          route: "/supplier-payments",
          severity: "warning" as const,
          action: "Review supplier"
        }
      : null,
    metrics.labourAdvanceBalance > 0
      ? {
          title: "Labour balance pending",
          message: `${formatMoney(metrics.labourAdvanceBalance)} labour balance remains in labour profiles.`,
          route: "/labour",
          severity: "warning" as const,
          action: "Open labour"
        }
      : null,
    syncStatus.failedCount > 0
      ? {
          title: "Sync failed",
          message: syncStatus.detail,
          route: "/settings#supabase-sync",
          severity: "critical" as const,
          action: "Retry sync"
        }
      : syncStatus.pendingCount > 0
        ? {
            title: "Cloud upload pending",
            message: `${syncStatus.pendingCount} entries are safe on this phone and waiting for cloud upload.`,
            route: "/settings#supabase-sync",
            severity: "info" as const,
            action: "Open sync"
          }
        : null,
    automation.actions[0]
      ? {
          title: automation.actions[0].title,
          message: automation.actions[0].description,
          route: automation.actions[0].route,
          severity: "info" as const,
          action: "Review"
        }
      : null
  ]
    .filter(isAttentionItem)
    .sort((a, b) => severityRank(a) - severityRank(b))
    .slice(0, 5);

  const quickEntries = [
    { label: "Attendance", path: "/attendance?add=1", icon: calendarOutline },
    { label: "Expense", path: "/expenses?add=1", icon: receiptOutline },
    { label: "Material", path: "/materials?add=1", icon: cubeOutline },
    { label: "Progress", path: "/progress?add=1", icon: cameraOutline },
    { label: "Payment", path: "/payments?add=1", icon: walletOutline },
    { label: "All Actions", path: "/quick-entry", icon: constructOutline }
  ];

  const go = (path: string) => router.push(withSite(path, selectedSiteId));

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <p>{`${greeting.greeting}, ${greeting.displayName}`}</p>
          <button type="button" onClick={() => go("/quick-entry")}>
            Add Today
          </button>
        </div>
        <h2>{scopeLabel}</h2>
        <p>
          {greeting.dateLabel} - {scopeSub}
        </p>
        <div className={styles.heroGrid}>
          <button className={styles.heroMini} type="button" onClick={() => go("/settings#supabase-sync")}>
            <span>Sync Status</span>
            <strong>{syncStatus.label}</strong>
            <small>{syncStatus.detail}</small>
          </button>
          <button className={styles.heroMini} type="button" onClick={() => go("/reports")}>
            <span>Estimated Profit</span>
            <strong>{formatMoney(metrics.estimatedProfit)}</strong>
            <small>Based on recorded entries</small>
          </button>
        </div>
      </div>

      <div className={styles.filterBar} aria-label="Dashboard filters">
        <button type="button" onClick={() => go("/sites")}>
          Viewing: {scopeLabel}
        </button>
        <select aria-label="Dashboard date range" value={datePreset} onChange={(event) => setDatePreset(event.target.value as DashboardDatePreset)}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="this_week">This week</option>
          <option value="this_month">This month</option>
        </select>
      </div>

      {dashboardError ? (
        <Card>
          <CardHeader
            title="Some dashboard data could not be loaded"
            subtitle="Payments, supplier balances, or profit may be incomplete until all records load."
            action={<Badge tone="warning">Partial data</Badge>}
          />
          <Button variant="secondary" onClick={retryDashboard}>Retry Dashboard</Button>
        </Card>
      ) : null}

      <div className={styles.grid}>
        <Card className={styles.metric} role="button" tabIndex={0} onClick={() => go("/attendance")}>
          <span>{dateRange.heading} Labour</span>
          {dashboardLoading ? <Skeleton className={styles.metricSkeleton} /> : <strong>{attendanceSummary.total ? `${attendanceSummary.present + attendanceSummary.halfDay} workers` : "Not marked"}</strong>}
          <Badge tone={attendanceSummary.total ? "success" : "warning"}>
            {attendanceSummary.total ? `${attendanceSummary.present} present - ${attendanceSummary.halfDay} half - ${attendanceSummary.absent} absent` : "Open attendance"}
          </Badge>
          <small>{formatMoney(periodLabourCost)} wage cost</small>
        </Card>
        <Card className={styles.metric} role="button" tabIndex={0} onClick={() => go("/expenses")}>
          <span>{dateRange.heading} Spend</span>
          {dashboardLoading ? <Skeleton className={styles.metricSkeleton} /> : <strong>{formatMoney(periodSpend)}</strong>}
          <Badge tone="neutral">Labour + material + other</Badge>
          <small>
            Labour {formatMoney(periodLabourCost)} - Material {formatMoney(periodMaterialCost)}
          </small>
        </Card>
        <Card className={styles.metric} role="button" tabIndex={0} onClick={() => go("/payments")}>
          <span>Client Receivable</span>
          {dashboardLoading ? <Skeleton className={styles.metricSkeleton} /> : <strong>{formatMoney(metrics.pendingClientPayments)}</strong>}
          <Badge tone={metrics.pendingClientPayments > 0 ? "warning" : "success"}>{metrics.pendingClientPayments > 0 ? "Outstanding" : "Clear"}</Badge>
          <small>Total outstanding from recorded payments</small>
        </Card>
        <Card className={styles.metric} role="button" tabIndex={0} onClick={() => go("/progress")}>
          <span>Overall Site Progress</span>
          {dashboardLoading ? <Skeleton className={styles.metricSkeleton} /> : <strong>{progressAverage}%</strong>}
          <Badge tone={periodProgress.length ? "success" : "warning"}>{periodProgress.length ? `${periodProgress.length} updates` : "Add update"}</Badge>
          <small>{lastUpdatedLabel(progressLastUpdated)}</small>
        </Card>
      </div>

      <Card>
        <CardHeader title="Requires Attention" subtitle="Highest-priority actions for the selected site and date." action={<IonIcon icon={alertCircleOutline} />} />
        {attentionItems.length ? (
          <div className={styles.alertList}>
            {attentionItems.map((item) => (
              <button
                className={`${styles.alert} ${item.severity === "critical" ? styles.alertCritical : item.severity === "warning" ? styles.alertWarning : ""}`}
                key={item.title}
                type="button"
                onClick={() => go(item.route)}
              >
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <small>{item.action}</small>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing urgent right now" description="Payment, attendance, progress, sync, and labour alerts will appear here when they need action." />
        )}
      </Card>

      <Card>
        <CardHeader title="Quick Entry" subtitle="One-hand actions for daily site work." />
        <div className={styles.quickGrid}>
          {quickEntries.map((action) => (
            <button key={action.path} className={styles.quick} type="button" onClick={() => go(action.path)}>
              <IonIcon icon={action.icon} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Cash Flow" subtitle="Money received, spent, receivable, payable, and estimated profit." />
        <div className={styles.grid}>
          <div className={styles.miniPanel}>
            <span>Received</span>
            <strong>{formatMoney(metrics.monthlyIncome)}</strong>
          </div>
          <div className={styles.miniPanel}>
            <span>Spent</span>
            <strong>{formatMoney(metrics.monthlyExpense)}</strong>
          </div>
          <div className={styles.miniPanel}>
            <span>Net Cash Flow</span>
            <strong>{formatMoney(metrics.monthlyIncome - metrics.monthlyExpense)}</strong>
          </div>
          <div className={styles.miniPanel}>
            <span>Client Receivable</span>
            <strong>{formatMoney(metrics.pendingClientPayments)}</strong>
          </div>
          <div className={styles.miniPanel}>
            <span>Supplier Payable</span>
            <strong>{formatMoney(metrics.pendingSupplierPayments)}</strong>
          </div>
          <div className={styles.miniPanel}>
            <span>Estimated Profit</span>
            <strong>{formatMoney(metrics.estimatedProfit)}</strong>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Project Health" subtitle="Budget and progress are compared from recorded entries only." />
        <div className={styles.healthGrid}>
          <div>
            <span>Contract Value</span>
            <strong>{formatMoney(contractValue)}</strong>
          </div>
          <div>
            <span>Recorded Cost</span>
            <strong>{formatMoney(recordedCost)}</strong>
          </div>
          <div>
            <span>Progress</span>
            <strong>{progressAverage}%</strong>
          </div>
          <div>
            <span>Cost Consumed</span>
            <strong>{costConsumed}%</strong>
          </div>
        </div>
        <p className={styles.healthNote}>
          {contractValue > 0
            ? costVariance > 0
              ? `Cost is ${costVariance}% ahead of recorded progress. Review expenses and material usage.`
              : `Cost is ${Math.abs(costVariance)}% behind or aligned with recorded progress.`
            : "Add site budget/contract value to unlock variance tracking."}
        </p>
      </Card>

      <div className={styles.liveRibbon}>
        <button type="button" onClick={() => go("/sites")}>
          <span>Active Sites</span>
          <strong>{metrics.activeSites}</strong>
        </button>
        <button type="button" onClick={() => go("/extra-works")}>
          <span>Unbilled Extra</span>
          <strong>{formatMoney(metrics.unbilledExtraWorks)}</strong>
        </button>
        <button type="button" onClick={() => go("/partner-ledger")}>
          <span>Partner Draws</span>
          <strong>{formatMoney(metrics.partnerDrawsTotal)}</strong>
        </button>
        <button type="button" onClick={() => go("/data-health")}>
          <span>Data Risks</span>
          <strong>{intelligence.siteHealth.filter((site) => site.riskLevel !== "info").length}</strong>
        </button>
      </div>

      <Card>
        <CardHeader title="Advanced Tools" subtitle="Reports, bill scanner, recovery, AI, and closing tools live below daily work." />
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
          <button className={styles.commandTile} type="button" onClick={() => go("/bill-scanner")}>
            <span>Scan Supplier Bill</span>
            <strong>OCR Entry</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => go("/ai")}>
            <span>Ask AI</span>
            <strong>Smart Drafts</strong>
          </button>
          <button className={styles.commandTile} type="button" onClick={() => go("/cash-flow")}>
            <span>Cash Flow</span>
            <strong>Forecast</strong>
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent Activity" subtitle={selectedSite ? `Only ${selectedSite.name} activity is shown.` : "Latest saved business actions across all sites."} />
        {scopedActivity.length ? (
          <div className={styles.timeline}>
            {scopedActivity.slice(0, 6).map((item) => (
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
