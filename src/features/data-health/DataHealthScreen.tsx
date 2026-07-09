"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { businessIntelligence } from "@/utils/business-logic";
import { formatMoney } from "@/utils/format";

type HealthItem = {
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
};

export function DataHealthScreen() {
  const { company } = useAuth();
  const sites = useRecords("sites", company?.id);
  const attendance = useRecords("attendance", company?.id);
  const materials = useRecords("materials", company?.id);
  const expenses = useRecords("expenses", company?.id);
  const payments = useRecords("client_payments", company?.id);
  const supplierPayments = useRecords("supplier_payments", company?.id);
  const progress = useRecords("progress_updates", company?.id);

  const items: HealthItem[] = [];
  const attendanceKeys = new Set<string>();
  for (const item of attendance.data || []) {
    const key = `${item.site_id}:${item.labour_id}:${item.date}`;
    if (attendanceKeys.has(key)) items.push({ title: "Duplicate attendance", message: `Duplicate attendance found for ${item.date}.`, severity: "critical" });
    attendanceKeys.add(key);
  }

  const billNumbers = new Set<string>();
  for (const item of materials.data || []) {
    if (item.total < 0) items.push({ title: "Negative material total", message: `${item.material_name} has a negative total.`, severity: "critical" });
    if (item.bill_number) {
      if (billNumbers.has(item.bill_number)) items.push({ title: "Duplicate material bill", message: `Bill number ${item.bill_number} appears more than once.`, severity: "warning" });
      billNumbers.add(item.bill_number);
    }
  }

  for (const item of expenses.data || []) {
    if (item.amount < 0) items.push({ title: "Negative expense", message: `${item.category} expense has a negative amount.`, severity: "critical" });
    if (item.amount > 100000) items.push({ title: "High expense", message: `${item.category} expense is ${formatMoney(item.amount)}.`, severity: "warning" });
  }

  for (const site of sites.data || []) {
    const sitePayments = (payments.data || []).filter((item) => item.site_id === site.id).reduce((total, item) => total + item.received_amount, 0);
    const siteExpense = [
      ...(materials.data || []).filter((item) => item.site_id === site.id).map((item) => item.total),
      ...(expenses.data || []).filter((item) => item.site_id === site.id).map((item) => item.amount)
    ].reduce((total, amount) => total + amount, 0);
    if (site.budget && siteExpense > site.budget) {
      items.push({ title: "Site budget exceeded", message: `${site.name} cost ${formatMoney(siteExpense)} is above budget ${formatMoney(site.budget)}.`, severity: "critical" });
    }
    if (sitePayments === 0 && site.status === "active") {
      items.push({ title: "No payment mapped", message: `${site.name} has no client payment record yet.`, severity: "info" });
    }
  }

  const intelligence = businessIntelligence({
    sites: sites.data || [],
    attendance: attendance.data || [],
    materials: materials.data || [],
    expenses: expenses.data || [],
    payments: payments.data || [],
    supplierPayments: supplierPayments.data || [],
    progress: progress.data || []
  });

  for (const site of intelligence.siteHealth) {
    if (site.riskLevel === "critical") {
      items.push({
        title: "Critical site risk",
        message: `${site.siteName} risk is ${site.riskScore}%. Budget used ${site.budgetUsedPercent}%, payment coverage ${site.paymentCoveragePercent}%.`,
        severity: "critical"
      });
    } else if (site.riskLevel === "warning") {
      items.push({
        title: "Site risk warning",
        message: `${site.siteName} risk is ${site.riskScore}%. Check payment, budget, and progress.`,
        severity: "warning"
      });
    }
    if (site.daysSinceProgress != null && site.daysSinceProgress >= 4) {
      items.push({
        title: "Progress update stale",
        message: `${site.siteName} has no progress update for ${site.daysSinceProgress} days.`,
        severity: "warning"
      });
    }
  }

  for (const item of supplierPayments.data || []) {
    if (item.pending_amount > 0) items.push({ title: "Supplier unpaid bill", message: `Supplier pending amount ${formatMoney(item.pending_amount)} remains.`, severity: "warning" });
  }

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <Card>
        <CardHeader title="Data Health" subtitle="Checks duplicates, negative values, missing payment mapping, unpaid bills, and budget risk." />
      </Card>
      {items.length ? (
        items.map((item, index) => (
          <Card key={`${item.title}-${index}`}>
            <CardHeader title={item.title} subtitle={item.message} action={<Badge tone={item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : "info"}>{item.severity}</Badge>} />
          </Card>
        ))
      ) : (
        <EmptyState title="No data health issues" description="The app will flag duplicates, missing site assignment, negative values, suspicious expenses, and budget overrun." />
      )}
    </section>
  );
}
