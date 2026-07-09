"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { exportCsv, exportExcel, exportPdf, type ReportRow } from "@/services/export";
import { businessIntelligence } from "@/utils/business-logic";
import { dashboardMetrics } from "@/utils/calc";
import { formatMoney } from "@/utils/format";
import styles from "./Reports.module.css";

type ReportDef = {
  key: string;
  title: string;
  description: string;
  rows: ReportRow[];
};

export function ReportsScreen() {
  const { company } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const sites = useRecords("sites", company?.id);
  const labour = useRecords("labour", company?.id);
  const attendance = useRecords("attendance", company?.id);
  const materials = useRecords("materials", company?.id);
  const suppliers = useRecords("suppliers", company?.id);
  const expenses = useRecords("expenses", company?.id);
  const payments = useRecords("client_payments", company?.id);
  const supplierPayments = useRecords("supplier_payments", company?.id);
  const progress = useRecords("progress_updates", company?.id);

  const metrics = dashboardMetrics({
    sites: sites.data || [],
    labour: labour.data || [],
    attendance: attendance.data || [],
    materials: materials.data || [],
    expenses: expenses.data || [],
    payments: payments.data || [],
    supplierPayments: supplierPayments.data || []
  });

  const intelligence = useMemo(
    () =>
      businessIntelligence({
        sites: sites.data || [],
        attendance: attendance.data || [],
        materials: materials.data || [],
        expenses: expenses.data || [],
        payments: payments.data || [],
        supplierPayments: supplierPayments.data || [],
        progress: progress.data || []
      }),
    [attendance.data, expenses.data, materials.data, payments.data, progress.data, sites.data, supplierPayments.data]
  );

  const reports = useMemo<ReportDef[]>(
    () => [
      {
        key: "daily-report",
        title: "Daily Report",
        description: "Today labour, materials, expenses, payments, and progress.",
        rows: [
          { metric: "Today labour cost", value: formatMoney(metrics.todayLabourCost) },
          { metric: "Today material cost", value: formatMoney(metrics.todayMaterialCost) },
          { metric: "Today expenses", value: formatMoney(metrics.todayExpenses) },
          { metric: "Pending client payments", value: formatMoney(metrics.pendingClientPayments) }
        ]
      },
      {
        key: "site-report",
        title: "Site-wise Report",
        description: "Budget, progress, status, and client details for each site.",
        rows: (sites.data || []).map((site) => ({
          site: site.name,
          client: site.client_name,
          mobile: site.client_mobile || "",
          status: site.status,
          budget: formatMoney(site.budget),
          progress: `${site.progress_percent}%`
        }))
      },
      {
        key: "labour-report",
        title: "Labour Report",
        description: "Labour wages, advances, balances, and attendance cost.",
        rows: (labour.data || []).map((item) => ({
          labour: item.full_name,
          mobile: item.mobile || "",
          work: item.work_type,
          daily_wage: formatMoney(item.default_daily_wage),
          advance: formatMoney(item.advance_payment),
          balance: formatMoney(item.balance_payment)
        }))
      },
      {
        key: "material-report",
        title: "Material Report",
        description: "Material purchases, supplier, bill number, and payment status.",
        rows: (materials.data || []).map((item) => ({
          date: item.date,
          material: item.material_name,
          quantity: `${item.quantity} ${item.unit}`,
          supplier: item.supplier_name || suppliers.data?.find((supplier) => supplier.id === item.supplier_id)?.name || "",
          bill: item.bill_number || "",
          total: formatMoney(item.total),
          status: item.payment_status
        }))
      },
      {
        key: "expense-report",
        title: "Expense Report",
        description: "Site expenses by category, amount, mode, and notes.",
        rows: (expenses.data || []).map((item) => ({
          date: item.date,
          category: item.category,
          amount: formatMoney(item.amount),
          mode: item.payment_mode,
          notes: item.notes || ""
        }))
      },
      {
        key: "payment-report",
        title: "Payment Report",
        description: "Client and supplier payment summary with pending balances.",
        rows: [
          ...(payments.data || []).map((item) => ({
            type: "Client",
            site: sites.data?.find((site) => site.id === item.site_id)?.name || "",
            received: formatMoney(item.received_amount),
            pending: formatMoney(item.pending_amount),
            mode: item.payment_mode,
            date: item.payment_date
          })),
          ...(supplierPayments.data || []).map((item) => ({
            type: "Supplier",
            site: sites.data?.find((site) => site.id === item.site_id)?.name || "",
            received: formatMoney(item.paid_amount),
            pending: formatMoney(item.pending_amount),
            mode: item.payment_mode,
            date: item.payment_date
          }))
        ]
      },
      {
        key: "progress-report",
        title: "Progress Report",
        description: "Progress entries, site mapping, percentage, and notes.",
        rows: (progress.data || []).map((item) => ({
          date: item.date,
          site: sites.data?.find((site) => site.id === item.site_id)?.name || "",
          title: item.title,
          percent: `${item.progress_percent}%`,
          description: item.description
        }))
      },
      {
        key: "site-risk-report",
        title: "Smart Site Risk Report",
        description: "Budget usage, payment coverage, delay risk, progress age, and calculated site risk score.",
        rows: intelligence.siteHealth.map((site) => ({
          site: site.siteName,
          client: site.clientName,
          status: site.status,
          progress: `${site.progressPercent}%`,
          cost: formatMoney(site.totalCost),
          received: formatMoney(site.received),
          pending_client: formatMoney(site.pendingClient),
          profit: formatMoney(site.profit),
          budget_used: `${site.budgetUsedPercent}%`,
          payment_coverage: `${site.paymentCoveragePercent}%`,
          days_to_due: site.daysUntilDue ?? "",
          days_since_progress: site.daysSinceProgress ?? "",
          risk: `${site.riskScore}% ${site.riskLevel}`
        }))
      },
      {
        key: "today-focus-report",
        title: "Today Focus Report",
        description: "Priority actions generated from payment, budget, attendance, delay, and progress logic.",
        rows: intelligence.focusActions.map((item) => ({
          priority: item.severity,
          action: item.title,
          details: item.message
        }))
      }
    ],
    [expenses.data, intelligence.focusActions, intelligence.siteHealth, labour.data, materials.data, metrics, payments.data, progress.data, sites.data, supplierPayments.data, suppliers.data]
  );

  const exportReport = async (report: ReportDef, type: "pdf" | "csv" | "excel") => {
    setBusy(`${report.key}-${type}`);
    const safeName = `${report.key}-${new Date().toISOString().slice(0, 10)}`;
    try {
      if (type === "pdf") await exportPdf({ title: report.title, subtitle: report.description, rows: report.rows, filename: `${safeName}.pdf` });
      if (type === "csv") exportCsv(report.rows, `${safeName}.csv`);
      if (type === "excel") exportExcel(report.rows, `${safeName}.xls`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <h2>Reports Center</h2>
        <p>Exports are generated on the phone from the current local/Supabase data. PDF, CSV, and Excel actions are separate for iPhone clarity.</p>
      </div>

      <Card>
        <CardHeader title="Monthly Summary" subtitle="Calculated from attendance, material, expense, client payment, and supplier payment records." />
        <div className={styles.summary}>
          <div>
            <span>Income</span>
            <strong>{formatMoney(metrics.monthlyIncome)}</strong>
          </div>
          <div>
            <span>Expense</span>
            <strong>{formatMoney(metrics.monthlyExpense)}</strong>
          </div>
          <div>
            <span>Profit/Loss</span>
            <strong>{formatMoney(metrics.estimatedProfit)}</strong>
          </div>
          <div>
            <span>Total Sites</span>
            <strong>{sites.data?.length || 0}</strong>
          </div>
        </div>
      </Card>

      <div className={styles.grid}>
        {reports.map((report) => (
          <Card key={report.key} className={styles.reportCard}>
            <CardHeader title={report.title} subtitle={`${report.description} ${report.rows.length} rows ready.`} />
            <div className={styles.actions}>
              <Button onClick={() => exportReport(report, "pdf")} disabled={busy === `${report.key}-pdf`}>
                PDF
              </Button>
              <Button variant="secondary" onClick={() => exportReport(report, "excel")} disabled={busy === `${report.key}-excel`}>
                Excel
              </Button>
              <Button variant="secondary" onClick={() => exportReport(report, "csv")} disabled={busy === `${report.key}-csv`}>
                CSV
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
