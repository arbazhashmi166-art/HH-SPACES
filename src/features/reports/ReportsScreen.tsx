"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { exportCsv, exportExcel, exportPdf, type ReportRow } from "@/services/export";
import { automationEngine } from "@/utils/automation-engine";
import { businessIntelligence } from "@/utils/business-logic";
import { dashboardMetrics } from "@/utils/calc";
import { formatMoney } from "@/utils/format";
import { marketRadar } from "@/utils/market-radar";
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
  const partnerDraws = useRecords("partner_draws", company?.id);
  const dailyClosings = useRecords("daily_closings", company?.id);
  const approvals = useRecords("approval_requests", company?.id);
  const progress = useRecords("progress_updates", company?.id);
  const extraWorks = useRecords("extra_works", company?.id);
  const progressPhotos = useRecords("progress_photos", company?.id);
  const reminders = useRecords("reminders", company?.id);
  const aiMessages = useRecords("ai_messages", company?.id);

  const metrics = dashboardMetrics({
    sites: sites.data || [],
    labour: labour.data || [],
    attendance: attendance.data || [],
    materials: materials.data || [],
    expenses: expenses.data || [],
    payments: payments.data || [],
    supplierPayments: supplierPayments.data || [],
    extraWorks: extraWorks.data || [],
    partnerDraws: partnerDraws.data || []
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

  const radar = useMemo(
    () =>
      marketRadar({
        sites: sites.data || [],
        labour: labour.data || [],
        attendance: attendance.data || [],
        materials: materials.data || [],
        suppliers: suppliers.data || [],
        expenses: expenses.data || [],
        payments: payments.data || [],
        supplierPayments: supplierPayments.data || [],
        progress: progress.data || [],
        progressPhotos: progressPhotos.data || [],
        extraWorks: extraWorks.data || [],
        reminders: reminders.data || [],
        aiMessages: aiMessages.data || []
      }),
    [
      aiMessages.data,
      attendance.data,
      expenses.data,
      extraWorks.data,
      labour.data,
      materials.data,
      payments.data,
      progress.data,
      progressPhotos.data,
      reminders.data,
      sites.data,
      supplierPayments.data,
      suppliers.data
    ]
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
        key: "partner-draws-report",
        title: "Partner Draws Report",
        description: "Company money taken by each partner for profit share, emergency, advance, salary, or reimbursement.",
        rows: [
          ...Object.entries(
            (partnerDraws.data || []).reduce<Record<string, number>>((totals, item) => {
              totals[item.partner_name] = (totals[item.partner_name] || 0) + Number(item.amount || 0);
              return totals;
            }, {})
          ).map(([partner, amount]) => ({
            section: "Partner total",
            partner,
            amount: formatMoney(amount)
          })),
          ...(partnerDraws.data || []).map((item) => ({
            section: "Entry",
            date: item.date,
            partner: item.partner_name,
            reason: item.category.replace("_", " "),
            amount: formatMoney(item.amount),
            mode: item.payment_mode,
            site: sites.data?.find((site) => site.id === item.site_id)?.name || "Company",
            approved_by: item.approved_by || "",
            notes: item.notes || ""
          }))
        ]
      },
      {
        key: "approval-report",
        title: "Approval Report",
        description: "Pending, approved, and rejected business decisions with amount, approver, and notes.",
        rows: (approvals.data || []).map((item) => ({
          created: item.created_at ? item.created_at.slice(0, 10) : "",
          status: item.status,
          category: item.category.replace("_", " "),
          title: item.title,
          amount: formatMoney(item.amount),
          site: item.site_id ? sites.data?.find((site) => site.id === item.site_id)?.name || "" : "Company",
          requested_by: item.requested_by_name || "",
          approver: item.approver_name || "",
          decided: item.decided_at ? item.decided_at.slice(0, 10) : "",
          notes: item.decision_notes || ""
        }))
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
        key: "extra-work-report",
        title: "Extra Works Report",
        description: "Variation work, client approval, amount increase, and unbilled billing status.",
        rows: (extraWorks.data || []).map((item) => ({
          date: item.date,
          site: sites.data?.find((site) => site.id === item.site_id)?.name || "",
          work_type: item.work_type,
          description: item.description,
          quantity: `${item.quantity} ${item.unit}`,
          rate: formatMoney(item.rate),
          amount: formatMoney(item.amount),
          approved: item.client_approved ? "Yes" : "No",
          status: item.status,
          notes: item.notes || ""
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
          approved_extra: formatMoney(site.approvedExtraWork),
          unbilled_extra: formatMoney(site.unbilledExtraWork),
          profit: formatMoney(site.profit),
          projected_profit: formatMoney(site.projectedProfit),
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
      },
      {
        key: "automation-report",
        title: "Automation Report",
        description: "Business autopilot score, cashflow radar, automation rules, and next best actions.",
        rows: [
          { section: "Operating score", metric: automation.scoreLabel, value: `${automation.operatingScore}/100` },
          { section: "Cashflow", metric: "Client pending", value: formatMoney(automation.cashflow.pendingClient) },
          { section: "Cashflow", metric: "Supplier exposure", value: formatMoney(automation.cashflow.supplierExposure) },
          { section: "Cashflow", metric: "Labour balance", value: formatMoney(automation.cashflow.labourBalance) },
          { section: "Cashflow", metric: "Partner draws", value: formatMoney(metrics.partnerDrawsTotal) },
          { section: "Cashflow", metric: "Approved extra work", value: formatMoney(automation.cashflow.approvedExtraWorks) },
          { section: "Cashflow", metric: "Unbilled extra work", value: formatMoney(automation.cashflow.unbilledExtraWorks) },
          { section: "Cashflow", metric: "Net after payables", value: formatMoney(automation.cashflow.netToCollectAfterPayables) },
          ...automation.actions.map((item) => ({
            section: "Next action",
            metric: item.severity,
            value: item.title,
            details: item.description
          })),
          ...automation.rules.map((item) => ({
            section: "Rule",
            metric: item.status,
            value: item.title,
            details: item.description
          }))
        ]
      },
      {
        key: "daily-close-checklist",
        title: "Daily Closing Checklist",
        description: "End-of-day operating checklist for attendance, costs, progress, payments, and reminders.",
        rows: automation.checklist.map((item) => ({
          task: item.title,
          status: item.done ? "Done" : "Open",
          details: item.description
        }))
      },
      {
        key: "saved-daily-closings",
        title: "Saved Daily Closings",
        description: "Saved end-of-day reports with site scope, checklist status, and notes.",
        rows: (dailyClosings.data || []).map((item) => ({
          date: item.date,
          site: sites.data?.find((site) => site.id === item.site_id)?.name || "All Sites",
          attendance: item.attendance_done ? "Done" : "Pending",
          material: item.material_done ? "Done" : "Pending",
          expense: item.expense_done ? "Done" : "Pending",
          progress: item.progress_done ? "Done" : "Pending",
          client_followup: item.client_followup_done ? "Done" : "Pending",
          notes: item.notes || "",
          report: item.report_text
        }))
      },
      {
        key: "market-radar-report",
        title: "Market Radar Report",
        description: "Latest construction-tech capability score and upgrade priorities for H&H SPACES.",
        rows: [
          { section: "Market power", metric: radar.headline, value: `${radar.marketPowerScore}/100` },
          ...radar.capabilities.map((item) => ({
            section: "Capability",
            metric: item.status,
            value: `${item.powerScore}/100 ${item.title}`,
            details: item.businessValue
          })),
          ...radar.playbook.map((item) => ({
            section: "Playbook",
            metric: item.cadence,
            value: item.title,
            details: item.description
          }))
        ]
      }
    ],
    [
      approvals.data,
      automation.actions,
      automation.cashflow,
      automation.checklist,
      automation.operatingScore,
      automation.rules,
      automation.scoreLabel,
      dailyClosings.data,
      expenses.data,
      extraWorks.data,
      intelligence.focusActions,
      intelligence.siteHealth,
      labour.data,
      materials.data,
      metrics,
      partnerDraws.data,
      payments.data,
      progress.data,
      radar.capabilities,
      radar.headline,
      radar.marketPowerScore,
      radar.playbook,
      sites.data,
      supplierPayments.data,
      suppliers.data
    ]
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
            <span>Partner Draws</span>
            <strong>{formatMoney(metrics.partnerDrawsTotal)}</strong>
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
