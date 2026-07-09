import type { Attendance, ClientPayment, Expense, Material, ProgressUpdate, Site, SupplierPayment } from "@/types/domain";
import { sumBy } from "./calc";
import { todayIso } from "./format";

export type SmartSeverity = "info" | "warning" | "critical";

export type SiteFinancialHealth = {
  siteId: string;
  siteName: string;
  clientName: string;
  status: Site["status"];
  progressPercent: number;
  budget: number;
  labourCost: number;
  materialCost: number;
  expenseCost: number;
  totalCost: number;
  received: number;
  pendingClient: number;
  pendingSupplier: number;
  profit: number;
  budgetUsedPercent: number;
  paymentCoveragePercent: number;
  daysUntilDue: number | null;
  daysSinceProgress: number | null;
  riskScore: number;
  riskLevel: SmartSeverity;
};

export type SmartBusinessAlert = {
  title: string;
  message: string;
  severity: SmartSeverity;
  siteId?: string;
};

export type BusinessIntelligence = {
  siteHealth: SiteFinancialHealth[];
  alerts: SmartBusinessAlert[];
  focusActions: SmartBusinessAlert[];
};

function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: string, to: string) {
  const fromDate = parseLocalDate(from);
  const toDate = parseLocalDate(to);
  if (!fromDate || !toDate) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

function maxDate(values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().at(-1) || null;
}

function severityFromScore(score: number): SmartSeverity {
  if (score >= 70) return "critical";
  if (score >= 35) return "warning";
  return "info";
}

function pushUnique(alerts: SmartBusinessAlert[], alert: SmartBusinessAlert) {
  const key = `${alert.title}:${alert.siteId || ""}`;
  if (!alerts.some((item) => `${item.title}:${item.siteId || ""}` === key)) alerts.push(alert);
}

export function businessIntelligence(input: {
  sites: Site[];
  attendance: Attendance[];
  materials: Material[];
  expenses: Expense[];
  payments: ClientPayment[];
  supplierPayments: SupplierPayment[];
  progress: ProgressUpdate[];
  today?: string;
}): BusinessIntelligence {
  const today = input.today || todayIso();
  const alerts: SmartBusinessAlert[] = [];
  const focusActions: SmartBusinessAlert[] = [];

  const todayAttendance = input.attendance.filter((item) => item.date === today);
  const activeSites = input.sites.filter((site) => site.status === "active");

  if (activeSites.length && todayAttendance.length === 0) {
    pushUnique(focusActions, {
      title: "Mark today's attendance",
      message: "No attendance is saved for today. Add it before labour cost gets missed.",
      severity: "warning"
    });
  }

  const pendingSupplier = sumBy(input.supplierPayments, (item) => item.pending_amount);
  if (pendingSupplier > 0) {
    pushUnique(alerts, {
      title: "Supplier balance open",
      message: `Supplier pending amount is ${pendingSupplier.toLocaleString("en-IN")}.`,
      severity: pendingSupplier > 100000 ? "critical" : "warning"
    });
  }

  const siteHealth = input.sites.map<SiteFinancialHealth>((site) => {
    const siteAttendance = input.attendance.filter((item) => item.site_id === site.id);
    const siteMaterials = input.materials.filter((item) => item.site_id === site.id);
    const siteExpenses = input.expenses.filter((item) => item.site_id === site.id);
    const sitePayments = input.payments.filter((item) => item.site_id === site.id);
    const siteSupplierPayments = input.supplierPayments.filter((item) => item.site_id === site.id);
    const siteProgress = input.progress.filter((item) => item.site_id === site.id);

    const labourCost = sumBy(siteAttendance, (item) => item.wage_amount);
    const materialCost = sumBy(siteMaterials, (item) => item.total);
    const expenseCost = sumBy(siteExpenses, (item) => item.amount);
    const totalCost = labourCost + materialCost + expenseCost;
    const received = sumBy(sitePayments, (item) => item.received_amount);
    const pendingClient = sumBy(sitePayments, (item) => item.pending_amount);
    const pendingSupplierForSite = sumBy(siteSupplierPayments, (item) => item.pending_amount);
    const profit = received - totalCost;
    const budgetUsedPercent = site.budget > 0 ? Math.round((totalCost / site.budget) * 100) : 0;
    const paymentCoveragePercent = totalCost > 0 ? Math.round((received / totalCost) * 100) : received > 0 ? 100 : 0;
    const daysUntilDue = site.expected_completion_date ? daysBetween(today, site.expected_completion_date) : null;
    const lastProgressDate = maxDate(siteProgress.map((item) => item.date));
    const daysSinceProgress = lastProgressDate ? daysBetween(lastProgressDate, today) : null;

    let riskScore = 0;
    if (site.status === "active" && daysUntilDue != null && daysUntilDue < 0) riskScore += 30;
    if (site.status === "active" && daysUntilDue != null && daysUntilDue <= 3 && daysUntilDue >= 0) riskScore += 15;
    if (budgetUsedPercent >= 100) riskScore += 35;
    else if (budgetUsedPercent >= 85) riskScore += 20;
    if (pendingClient > 0) riskScore += pendingClient > 100000 ? 25 : 12;
    if (profit < 0 && received > 0) riskScore += 15;
    if (site.status === "active" && (daysSinceProgress == null || daysSinceProgress >= 4)) riskScore += 15;
    if (totalCost > 0 && paymentCoveragePercent < 50) riskScore += 10;
    riskScore = Math.min(100, riskScore);

    const health: SiteFinancialHealth = {
      siteId: site.id,
      siteName: site.name,
      clientName: site.client_name,
      status: site.status,
      progressPercent: Number(site.progress_percent || 0),
      budget: Number(site.budget || 0),
      labourCost,
      materialCost,
      expenseCost,
      totalCost,
      received,
      pendingClient,
      pendingSupplier: pendingSupplierForSite,
      profit,
      budgetUsedPercent,
      paymentCoveragePercent,
      daysUntilDue,
      daysSinceProgress,
      riskScore,
      riskLevel: severityFromScore(riskScore)
    };

    if (health.riskLevel !== "info") {
      pushUnique(alerts, {
        title: `${health.siteName} risk ${health.riskScore}%`,
        message: `Budget used ${health.budgetUsedPercent}%, payment coverage ${health.paymentCoveragePercent}%, pending client ${health.pendingClient.toLocaleString("en-IN")}.`,
        severity: health.riskLevel,
        siteId: site.id
      });
    }

    if (pendingClient > 0) {
      pushUnique(focusActions, {
        title: `Collect payment from ${site.client_name}`,
        message: `${site.name} has ${pendingClient.toLocaleString("en-IN")} pending.`,
        severity: pendingClient > 100000 ? "critical" : "warning",
        siteId: site.id
      });
    }

    if (site.status === "active" && daysUntilDue != null && daysUntilDue < 0) {
      pushUnique(focusActions, {
        title: `Review delayed site`,
        message: `${site.name} passed expected completion by ${Math.abs(daysUntilDue)} days.`,
        severity: "critical",
        siteId: site.id
      });
    }

    if (site.status === "active" && (daysSinceProgress == null || daysSinceProgress >= 4)) {
      pushUnique(focusActions, {
        title: `Add progress update`,
        message: `${site.name} has no recent progress update.`,
        severity: "warning",
        siteId: site.id
      });
    }

    return health;
  });

  siteHealth.sort((a, b) => b.riskScore - a.riskScore);

  return {
    siteHealth,
    alerts: alerts.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)).slice(0, 8),
    focusActions: focusActions.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)).slice(0, 6)
  };
}

function severityWeight(severity: SmartSeverity) {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}
