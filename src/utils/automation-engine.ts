import type { Attendance, ClientPayment, Expense, ExtraWork, Labour, Material, ProgressUpdate, Reminder, Site, SupplierPayment } from "@/types/domain";
import { businessIntelligence, type SmartSeverity } from "./business-logic";
import { sumBy } from "./calc";
import { todayIso } from "./format";

export type AutomationCategory = "daily" | "money" | "site" | "supplier" | "labour" | "report" | "system";

export type AutomationAction = {
  id: string;
  title: string;
  description: string;
  severity: SmartSeverity;
  category: AutomationCategory;
  route: string;
  primaryAction: string;
  reminderTitle?: string;
  reminderDescription?: string;
  whatsappMessage?: string;
};

export type AutomationRule = {
  id: string;
  title: string;
  description: string;
  category: AutomationCategory;
  status: "active" | "watching" | "needs-data";
  severity: SmartSeverity;
};

export type DailyChecklistItem = {
  title: string;
  description: string;
  done: boolean;
  route: string;
};

export type CashflowRadar = {
  pendingClient: number;
  supplierExposure: number;
  labourBalance: number;
  unpaidMaterialBills: number;
  approvedExtraWorks: number;
  unbilledExtraWorks: number;
  expectedLabour7Days: number;
  averageDailyBurn: number;
  netToCollectAfterPayables: number;
  pressure: SmartSeverity;
};

export type AutomationEngineResult = {
  operatingScore: number;
  scoreLabel: string;
  cashflow: CashflowRadar;
  actions: AutomationAction[];
  rules: AutomationRule[];
  checklist: DailyChecklistItem[];
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: string, to: string) {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (!fromDate || !toDate) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

function addDays(value: string, days: number) {
  const date = parseDate(value) || new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function inLastDays(date: string | null | undefined, today: string, days: number) {
  if (!date) return false;
  const diff = daysBetween(date, today);
  return diff != null && diff >= 0 && diff <= days;
}

function uniquePush(actions: AutomationAction[], action: AutomationAction) {
  if (!actions.some((item) => item.id === action.id)) actions.push(action);
}

function severityRank(severity: SmartSeverity) {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function moneyText(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

function scoreLabel(score: number) {
  if (score >= 82) return "Strong control";
  if (score >= 62) return "Needs attention";
  if (score >= 42) return "High pressure";
  return "Critical follow-up";
}

export function automationEngine(input: {
  sites: Site[];
  labour: Labour[];
  attendance: Attendance[];
  materials: Material[];
  expenses: Expense[];
  payments: ClientPayment[];
  supplierPayments: SupplierPayment[];
  progress: ProgressUpdate[];
  extraWorks?: ExtraWork[];
  reminders?: Reminder[];
  today?: string;
}): AutomationEngineResult {
  const today = input.today || todayIso();
  const intelligence = businessIntelligence({
    sites: input.sites,
    attendance: input.attendance,
    materials: input.materials,
    expenses: input.expenses,
    payments: input.payments,
    supplierPayments: input.supplierPayments,
    progress: input.progress,
    extraWorks: input.extraWorks || [],
    today
  });

  const activeSites = input.sites.filter((site) => site.status === "active");
  const todayAttendance = input.attendance.filter((item) => item.date === today);
  const todayProgress = input.progress.filter((item) => item.date === today);
  const todayExpenses = input.expenses.filter((item) => item.date === today);
  const todayMaterials = input.materials.filter((item) => item.date === today);
  const openReminders = (input.reminders || []).filter((item) => item.status === "open" && (!item.snoozed_until || item.snoozed_until <= today));
  const overdueReminders = openReminders.filter((item) => item.due_date < today);

  const pendingClient = sumBy(input.payments, (item) => item.pending_amount);
  const supplierPaymentPending = sumBy(input.supplierPayments, (item) => item.pending_amount);
  const unpaidMaterialBills = sumBy(
    input.materials.filter((item) => item.payment_status !== "paid"),
    (item) => item.total
  );
  const labourBalance = sumBy(input.labour, (item) => item.balance_payment);
  const supplierExposure = supplierPaymentPending + unpaidMaterialBills;
  const approvedExtraWorks = sumBy(
    (input.extraWorks || []).filter((item) => item.client_approved || item.status === "approved" || item.status === "billed" || item.status === "paid"),
    (item) => item.amount
  );
  const unbilledExtraWorks = sumBy(
    (input.extraWorks || []).filter((item) => (item.client_approved || item.status === "approved") && item.status !== "billed" && item.status !== "paid"),
    (item) => item.amount
  );
  const pendingExtraApproval = sumBy(
    (input.extraWorks || []).filter((item) => !item.client_approved && item.status === "draft"),
    (item) => item.amount
  );

  const recentAttendance = input.attendance.filter((item) => inLastDays(item.date, today, 14));
  const recentMaterials = input.materials.filter((item) => inLastDays(item.date, today, 14));
  const recentExpenses = input.expenses.filter((item) => inLastDays(item.date, today, 14));
  const recentCost =
    sumBy(recentAttendance, (item) => item.wage_amount) +
    sumBy(recentMaterials, (item) => item.total) +
    sumBy(recentExpenses, (item) => item.amount);
  const activeRecentDays = new Set([
    ...recentAttendance.map((item) => item.date),
    ...recentMaterials.map((item) => item.date),
    ...recentExpenses.map((item) => item.date)
  ]).size;
  const averageDailyBurn = activeRecentDays > 0 ? Math.round(recentCost / activeRecentDays) : 0;
  const attendanceDays = new Set(recentAttendance.map((item) => item.date)).size;
  const averageDailyLabour = attendanceDays > 0 ? Math.round(sumBy(recentAttendance, (item) => item.wage_amount) / attendanceDays) : 0;
  const fallbackDailyLabour = input.labour.filter((item) => item.status === "active").slice(0, 12).reduce((total, item) => total + item.default_daily_wage, 0);
  const expectedLabour7Days = (averageDailyLabour || fallbackDailyLabour) * 7;
  const netToCollectAfterPayables = pendingClient - supplierExposure - labourBalance;

  let pressure: SmartSeverity = "info";
  if (netToCollectAfterPayables < 0 || supplierExposure + labourBalance > pendingClient * 0.75) pressure = "critical";
  else if (supplierExposure + labourBalance > pendingClient * 0.35 || pendingClient > 0) pressure = "warning";

  const actions: AutomationAction[] = [];
  if (activeSites.length && todayAttendance.length === 0) {
    uniquePush(actions, {
      id: "daily-attendance",
      title: "Mark today's attendance",
      description: "Attendance is not saved for today. Wages and daily report will be incomplete until it is added.",
      severity: "critical",
      category: "daily",
      route: "/attendance?add=1",
      primaryAction: "Add Attendance",
      reminderTitle: "Mark today's attendance",
      reminderDescription: "Daily attendance is missing. Add present, half day, absent, and overtime entries."
    });
  }

  const highestPendingSite = intelligence.siteHealth.find((site) => site.pendingClient > 0);
  if (highestPendingSite) {
    uniquePush(actions, {
      id: `collect-${highestPendingSite.siteId}`,
      title: `Collect ${moneyText(highestPendingSite.pendingClient)} from ${highestPendingSite.clientName}`,
      description: `${highestPendingSite.siteName} has pending client payment. This is the fastest way to improve cashflow.`,
      severity: highestPendingSite.pendingClient > 100000 ? "critical" : "warning",
      category: "money",
      route: "/payments?add=1",
      primaryAction: "Open Payments",
      reminderTitle: `Follow up payment: ${highestPendingSite.siteName}`,
      reminderDescription: `${highestPendingSite.clientName} pending payment is ${moneyText(highestPendingSite.pendingClient)}.`,
      whatsappMessage: `Hello ${highestPendingSite.clientName}, payment of ${moneyText(highestPendingSite.pendingClient)} is pending for ${highestPendingSite.siteName}. Please share the payment update.`
    });
  }

  const criticalSite = intelligence.siteHealth.find((site) => site.riskLevel === "critical");
  if (criticalSite) {
    uniquePush(actions, {
      id: `risk-${criticalSite.siteId}`,
      title: `Control ${criticalSite.siteName} risk`,
      description: `Risk is ${criticalSite.riskScore}%. Budget used ${criticalSite.budgetUsedPercent}% and payment coverage is ${criticalSite.paymentCoveragePercent}%.`,
      severity: "critical",
      category: "site",
      route: "/data-health",
      primaryAction: "Check Risk",
      reminderTitle: `Review risk: ${criticalSite.siteName}`,
      reminderDescription: `Budget, payment, progress, or delay risk needs review. Risk score ${criticalSite.riskScore}%.`
    });
  }

  const staleProgress = intelligence.siteHealth.find((site) => site.status === "active" && (site.daysSinceProgress == null || site.daysSinceProgress >= 4));
  if (staleProgress) {
    uniquePush(actions, {
      id: `progress-${staleProgress.siteId}`,
      title: `Update progress for ${staleProgress.siteName}`,
      description: staleProgress.daysSinceProgress == null ? "No progress entry found yet." : `No progress entry for ${staleProgress.daysSinceProgress} days.`,
      severity: "warning",
      category: "site",
      route: "/progress?add=1",
      primaryAction: "Add Progress",
      reminderTitle: `Add progress: ${staleProgress.siteName}`,
      reminderDescription: "Progress photos and notes keep the site timeline ready for client reports."
    });
  }

  if (supplierExposure > 0) {
    uniquePush(actions, {
      id: "supplier-exposure",
      title: `Plan supplier dues ${moneyText(supplierExposure)}`,
      description: "Unpaid supplier/material exposure is open. Record paid amount or schedule follow-up.",
      severity: supplierExposure > 100000 ? "critical" : "warning",
      category: "supplier",
      route: "/supplier-payments?add=1",
      primaryAction: "Supplier Pay",
      reminderTitle: "Review supplier pending",
      reminderDescription: `Supplier/material pending exposure is ${moneyText(supplierExposure)}.`
    });
  }

  if (unbilledExtraWorks > 0) {
    const siteWithExtra = intelligence.siteHealth.find((site) => site.unbilledExtraWork > 0);
    uniquePush(actions, {
      id: "extra-work-billing",
      title: `Bill approved extra work ${moneyText(unbilledExtraWorks)}`,
      description: siteWithExtra
        ? `${siteWithExtra.siteName} has ${moneyText(siteWithExtra.unbilledExtraWork)} approved extra work waiting for billing.`
        : "Approved variation work is waiting for billing.",
      severity: unbilledExtraWorks > 50000 ? "critical" : "warning",
      category: "money",
      route: "/extra-works",
      primaryAction: "Open Extra Works",
      reminderTitle: "Bill approved extra work",
      reminderDescription: `Approved unbilled extra work total is ${moneyText(unbilledExtraWorks)}.`
    });
  }

  if (pendingExtraApproval > 0) {
    uniquePush(actions, {
      id: "extra-work-approval",
      title: `Get approval for ${moneyText(pendingExtraApproval)} extra work`,
      description: "Draft variation work should be approved before it becomes disputed or forgotten.",
      severity: pendingExtraApproval > 50000 ? "warning" : "info",
      category: "money",
      route: "/extra-works",
      primaryAction: "Review Extra"
    });
  }

  if (labourBalance > 0) {
    uniquePush(actions, {
      id: "labour-balance",
      title: `Settle labour balance ${moneyText(labourBalance)}`,
      description: "Labour balance is pending. Clear or update advances before wage confusion starts.",
      severity: labourBalance > 50000 ? "warning" : "info",
      category: "labour",
      route: "/labour",
      primaryAction: "Open Labour",
      reminderTitle: "Review labour balance",
      reminderDescription: `Labour balance pending is ${moneyText(labourBalance)}.`
    });
  }

  if (overdueReminders.length) {
    uniquePush(actions, {
      id: "overdue-reminders",
      title: `${overdueReminders.length} overdue reminders`,
      description: "Some reminders are past due. Finish, snooze, or update them so work does not slip.",
      severity: "warning",
      category: "system",
      route: "/reminders",
      primaryAction: "Open Reminders"
    });
  }

  const checklist: DailyChecklistItem[] = [
    {
      title: "Attendance saved",
      description: todayAttendance.length ? `${todayAttendance.length} attendance entries saved today.` : "No attendance saved today.",
      done: todayAttendance.length > 0 || activeSites.length === 0,
      route: "/attendance?add=1"
    },
    {
      title: "Daily costs captured",
      description: todayExpenses.length || todayMaterials.length ? "Today expenses/materials are recorded." : "No cost entry saved today.",
      done: todayExpenses.length > 0 || todayMaterials.length > 0,
      route: "/expenses?add=1"
    },
    {
      title: "Progress updated",
      description: todayProgress.length ? `${todayProgress.length} progress updates saved today.` : "No progress update saved today.",
      done: todayProgress.length > 0 || activeSites.length === 0,
      route: "/progress?add=1"
    },
    {
      title: "Receivables checked",
      description: pendingClient > 0 ? `${moneyText(pendingClient)} client payment is pending.` : "No client pending payment.",
      done: pendingClient === 0,
      route: "/payments"
    },
    {
      title: "Extra work billed",
      description: unbilledExtraWorks > 0 ? `${moneyText(unbilledExtraWorks)} approved extra work is unbilled.` : "No approved extra work waiting for billing.",
      done: unbilledExtraWorks === 0,
      route: "/extra-works"
    },
    {
      title: "Reminders clear",
      description: overdueReminders.length ? `${overdueReminders.length} reminders are overdue.` : "No overdue reminders.",
      done: overdueReminders.length === 0,
      route: "/reminders"
    }
  ];

  let score = 100;
  score -= actions.filter((item) => item.severity === "critical").length * 18;
  score -= actions.filter((item) => item.severity === "warning").length * 9;
  score -= checklist.filter((item) => !item.done).length * 5;
  if (pressure === "critical") score -= 15;
  if (pressure === "warning") score -= 8;
  if (unbilledExtraWorks > 0) score -= 7;
  score = Math.max(0, Math.min(100, score));

  const hasMoneyData = pendingClient > 0 || supplierExposure > 0 || input.payments.length > 0 || input.supplierPayments.length > 0;
  const rules: AutomationRule[] = [
    {
      id: "daily-attendance-guard",
      title: "Daily attendance guard",
      description: "Warns when active sites exist but today's attendance is missing.",
      category: "daily",
      status: activeSites.length ? "active" : "needs-data",
      severity: activeSites.length && todayAttendance.length === 0 ? "critical" : "info"
    },
    {
      id: "payment-collector",
      title: "Payment collector",
      description: "Finds the highest pending client payment and prepares reminder text.",
      category: "money",
      status: hasMoneyData ? "active" : "needs-data",
      severity: pendingClient > 0 ? "warning" : "info"
    },
    {
      id: "budget-guard",
      title: "Budget guard",
      description: "Compares labour, material, and expenses against each site budget.",
      category: "site",
      status: input.sites.length ? "active" : "needs-data",
      severity: intelligence.siteHealth.some((site) => site.budgetUsedPercent >= 100) ? "critical" : "info"
    },
    {
      id: "supplier-dues",
      title: "Supplier dues guard",
      description: "Tracks unpaid material bills and supplier payment balances.",
      category: "supplier",
      status: input.materials.length || input.supplierPayments.length ? "active" : "needs-data",
      severity: supplierExposure > 0 ? "warning" : "info"
    },
    {
      id: "progress-delay-watch",
      title: "Progress delay watch",
      description: "Flags active sites without fresh progress updates or overdue completion dates.",
      category: "site",
      status: activeSites.length ? "active" : "needs-data",
      severity: intelligence.siteHealth.some((site) => site.daysUntilDue != null && site.daysUntilDue < 0) ? "critical" : "info"
    },
    {
      id: "extra-work-recovery",
      title: "Extra work recovery",
      description: "Tracks variation work approvals and warns when approved work has not been billed.",
      category: "money",
      status: (input.extraWorks || []).length ? "active" : "needs-data",
      severity: unbilledExtraWorks > 0 ? "warning" : "info"
    },
    {
      id: "weekly-profit-pulse",
      title: "Weekly profit pulse",
      description: "Uses income, labour, materials, and expenses to guide profit/loss review.",
      category: "report",
      status: input.attendance.length || input.materials.length || input.expenses.length || input.payments.length ? "watching" : "needs-data",
      severity: netToCollectAfterPayables < 0 ? "warning" : "info"
    }
  ];

  return {
    operatingScore: score,
    scoreLabel: scoreLabel(score),
    cashflow: {
      pendingClient,
      supplierExposure,
      labourBalance,
      unpaidMaterialBills,
      approvedExtraWorks,
      unbilledExtraWorks,
      expectedLabour7Days,
      averageDailyBurn,
      netToCollectAfterPayables,
      pressure
    },
    actions: actions.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 8),
    rules,
    checklist
  };
}

export function nextReminderDate(today = todayIso()) {
  return addDays(today, 1);
}
