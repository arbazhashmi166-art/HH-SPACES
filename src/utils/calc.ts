import type { Attendance, ClientPayment, Expense, ExtraWork, Labour, Material, PartnerDraw, Site, SupplierPayment } from "@/types/domain";
import { monthKey, todayIso } from "./format";

export function sumBy<T>(rows: T[], read: (row: T) => number | null | undefined) {
  return rows.reduce((total, row) => total + Number(read(row) || 0), 0);
}

export function dashboardMetrics(input: {
  sites: Site[];
  attendance: Attendance[];
  materials: Material[];
  expenses: Expense[];
  payments: ClientPayment[];
  supplierPayments?: SupplierPayment[];
  labour?: Labour[];
  extraWorks?: ExtraWork[];
  partnerDraws?: PartnerDraw[];
}) {
  const today = todayIso();
  const month = monthKey();
  const activeSites = input.sites.filter((site) => site.status === "active").length;
  const todayLabourCost = sumBy(
    input.attendance.filter((item) => item.date === today),
    (item) => item.wage_amount
  );
  const todayMaterialCost = sumBy(
    input.materials.filter((item) => item.date === today),
    (item) => item.total
  );
  const todayExpenses = sumBy(
    input.expenses.filter((item) => item.date === today),
    (item) => item.amount
  );
  const monthlyIncome = sumBy(
    input.payments.filter((item) => item.payment_date?.startsWith(month)),
    (item) => item.received_amount
  );
  const monthlyMaterial = sumBy(
    input.materials.filter((item) => item.date?.startsWith(month)),
    (item) => item.total
  );
  const monthlyLabour = sumBy(
    input.attendance.filter((item) => item.date?.startsWith(month)),
    (item) => item.wage_amount
  );
  const monthlyExpense = sumBy(
    input.expenses.filter((item) => item.date?.startsWith(month)),
    (item) => item.amount
  ) + monthlyMaterial + monthlyLabour;
  const pendingClientPayments = sumBy(input.payments, (item) => item.pending_amount);
  const pendingSupplierPayments = sumBy(input.supplierPayments || [], (item) => item.pending_amount);
  const labourAdvanceBalance = sumBy(input.labour || [], (item) => item.balance_payment);
  const approvedExtraWorks = sumBy(
    (input.extraWorks || []).filter((item) => item.client_approved || item.status === "approved" || item.status === "billed" || item.status === "paid"),
    (item) => item.amount
  );
  const unbilledExtraWorks = sumBy(
    (input.extraWorks || []).filter((item) => (item.client_approved || item.status === "approved") && item.status !== "billed" && item.status !== "paid"),
    (item) => item.amount
  );
  const partnerDrawsTotal = sumBy(input.partnerDraws || [], (item) => item.amount);

  return {
    activeSites,
    todayLabourCost,
    todayMaterialCost,
    todayExpenses,
    pendingClientPayments,
    pendingSupplierPayments,
    labourAdvanceBalance,
    monthlyIncome,
    monthlyExpense,
    estimatedProfit: monthlyIncome - monthlyExpense,
    approvedExtraWorks,
    unbilledExtraWorks,
    partnerDrawsTotal
  };
}
