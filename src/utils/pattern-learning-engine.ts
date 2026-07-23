import type { Attendance, ClientPayment, Expense, Labour, Material, ProgressUpdate, Site, SupplierPayment } from "@/types/domain";
import { sumBy } from "./calc";
import { formatMoney, todayIso, toTitle } from "./format";

export type LearnedBusinessPattern = {
  id: string;
  title: string;
  message: string;
  confidence: number;
  route: string;
  action: string;
  tone: "success" | "warning" | "info";
};

export type BusinessLearningResult = {
  confidence: number;
  recordCount: number;
  defaultSiteId: string | null;
  defaultSiteName: string | null;
  patterns: LearnedBusinessPattern[];
};

type Counted<T> = {
  key: string;
  label: string;
  count: number;
  total: number;
  latest: string;
  value: T;
};

function latestDate(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort().at(-1) || "";
}

function confidenceFromCount(count: number, base = 42) {
  return Math.max(30, Math.min(96, Math.round(base + count * 5)));
}

function topGroup<T>(rows: T[], read: (row: T) => { key: string | null | undefined; label?: string | null; amount?: number; date?: string | null; value?: T }) {
  const groups = new Map<string, Counted<T>>();
  for (const row of rows) {
    const item = read(row);
    const key = String(item.key || "").trim().toLowerCase();
    if (!key) continue;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        label: String(item.label || item.key),
        count: 1,
        total: Number(item.amount || 0),
        latest: item.date || "",
        value: item.value || row
      });
      continue;
    }
    existing.count += 1;
    existing.total += Number(item.amount || 0);
    if ((item.date || "") > existing.latest) {
      existing.latest = item.date || "";
      existing.value = item.value || row;
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))[0] || null;
}

function routeWithSite(route: string, siteId: string | null) {
  if (!siteId) return route;
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}siteId=${encodeURIComponent(siteId)}`;
}

export function businessPatternLearning(input: {
  sites: Site[];
  labour: Labour[];
  attendance: Attendance[];
  materials: Material[];
  expenses: Expense[];
  payments: ClientPayment[];
  supplierPayments: SupplierPayment[];
  progress: ProgressUpdate[];
  today?: string;
}): BusinessLearningResult {
  const today = input.today || todayIso();
  const activeSites = input.sites.filter((site) => site.status === "active");
  const allRows = [
    ...input.sites,
    ...input.labour,
    ...input.attendance,
    ...input.materials,
    ...input.expenses,
    ...input.payments,
    ...input.supplierPayments,
    ...input.progress
  ];
  const recordCount = allRows.length;

  const siteActivity = activeSites
    .map((site) => {
      const rows = [
        ...input.attendance.filter((item) => item.site_id === site.id),
        ...input.materials.filter((item) => item.site_id === site.id),
        ...input.expenses.filter((item) => item.site_id === site.id),
        ...input.payments.filter((item) => item.site_id === site.id),
        ...input.supplierPayments.filter((item) => item.site_id === site.id),
        ...input.progress.filter((item) => item.site_id === site.id)
      ];
      return {
        site,
        count: rows.length,
        latest: latestDate(...rows.map((row) => row.updated_at))
      };
    })
    .sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));

  const defaultSite = siteActivity[0]?.site || activeSites[0] || null;
  const patterns: LearnedBusinessPattern[] = [];

  if (defaultSite && siteActivity[0]?.count) {
    patterns.push({
      id: "default-site",
      title: `Default site: ${defaultSite.name}`,
      message: `Most recent work is linked here, so quick entries can start with this site selected.`,
      confidence: confidenceFromCount(siteActivity[0].count),
      route: routeWithSite("/quick-entry", defaultSite.id),
      action: "Open quick entry",
      tone: "success"
    });
  }

  const todayAttendance = input.attendance.filter((item) => item.date === today && (!defaultSite || item.site_id === defaultSite.id));
  if (defaultSite && todayAttendance.length === 0) {
    patterns.push({
      id: "attendance-missing",
      title: "Learned daily habit: attendance first",
      message: `${defaultSite.name} has no attendance for today. The app will keep this as the first suggested entry.`,
      confidence: 88,
      route: routeWithSite("/attendance?add=1", defaultSite.id),
      action: "Mark attendance",
      tone: "warning"
    });
  }

  const topExpense = topGroup(input.expenses, (expense) => ({
    key: expense.category,
    label: toTitle(expense.category),
    amount: expense.amount,
    date: expense.date,
    value: expense
  }));
  if (topExpense) {
    patterns.push({
      id: "expense-pattern",
      title: `${topExpense.label} is your common expense`,
      message: `${topExpense.count} entries found. Average amount is ${formatMoney(topExpense.total / topExpense.count)}.`,
      confidence: confidenceFromCount(topExpense.count),
      route: "/expenses?add=1",
      action: "Add expense",
      tone: "info"
    });
  }

  const topMaterial = topGroup(input.materials, (material) => ({
    key: `${material.material_name}:${material.unit}`,
    label: `${material.material_name} / ${material.unit}`,
    amount: material.rate,
    date: material.date,
    value: material
  }));
  if (topMaterial) {
    const material = topMaterial.value as Material;
    const latestRate = Number(material.rate || 0);
    const averageRate = topMaterial.total / topMaterial.count;
    const rateJump = averageRate > 0 ? ((latestRate - averageRate) / averageRate) * 100 : 0;
    patterns.push({
      id: "material-rate-memory",
      title: `Material memory: ${material.material_name}`,
      message:
        Math.abs(rateJump) >= 12
          ? `Latest rate ${formatMoney(latestRate)} is ${Math.abs(Math.round(rateJump))}% ${rateJump > 0 ? "above" : "below"} your average ${formatMoney(averageRate)}.`
          : `Usual rate is around ${formatMoney(averageRate)} per ${material.unit}.`,
      confidence: confidenceFromCount(topMaterial.count),
      route: "/materials?add=1",
      action: "Use material",
      tone: Math.abs(rateJump) >= 12 ? "warning" : "success"
    });
  }

  const topLabour = topGroup(input.labour, (labour) => ({
    key: labour.work_type,
    label: labour.work_type,
    amount: labour.default_daily_wage,
    date: labour.updated_at,
    value: labour
  }));
  if (topLabour) {
    patterns.push({
      id: "labour-rate-memory",
      title: `Labour memory: ${topLabour.label}`,
      message: `${topLabour.count} workers found. Typical daily wage is ${formatMoney(topLabour.total / topLabour.count)}.`,
      confidence: confidenceFromCount(topLabour.count),
      route: "/labour?add=1",
      action: "Add labour",
      tone: "info"
    });
  }

  const pendingClient = sumBy(input.payments, (payment) => payment.pending_amount);
  const pendingSupplier = sumBy(input.supplierPayments, (payment) => payment.pending_amount);
  if (pendingClient > 0 || pendingSupplier > 0) {
    patterns.push({
      id: "money-follow-up",
      title: "Money follow-up learned",
      message: `Current records show ${formatMoney(pendingClient)} client receivable and ${formatMoney(pendingSupplier)} supplier payable.`,
      confidence: 90,
      route: pendingClient >= pendingSupplier ? "/payments" : "/supplier-payments",
      action: pendingClient >= pendingSupplier ? "Open payments" : "Open suppliers",
      tone: pendingClient > 0 ? "warning" : "info"
    });
  }

  if (!patterns.length) {
    patterns.push({
      id: "learning-start",
      title: "Learning starts after entries",
      message: "Add sites, labour, material, expenses and payments. The app will learn frequent sites, rates and daily habits automatically.",
      confidence: 35,
      route: "/quick-entry",
      action: "Add first entry",
      tone: "info"
    });
  }

  return {
    confidence: confidenceFromCount(recordCount, 35),
    recordCount,
    defaultSiteId: defaultSite?.id || null,
    defaultSiteName: defaultSite?.name || null,
    patterns: patterns.slice(0, 5)
  };
}
