import {
  addCircleOutline,
  albumsOutline,
  analyticsOutline,
  archiveOutline,
  barChartOutline,
  briefcaseOutline,
  businessOutline,
  calendarOutline,
  cashOutline,
  checkmarkDoneOutline,
  clipboardOutline,
  constructOutline,
  cubeOutline,
  documentTextOutline,
  fileTrayFullOutline,
  gridOutline,
  heartCircleOutline,
  notificationsOutline,
  peopleOutline,
  personCircleOutline,
  receiptOutline,
  searchOutline,
  settingsOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  syncOutline,
  walletOutline,
  warningOutline
} from "ionicons/icons";

export type AppRoute = {
  path: string;
  label: string;
  shortLabel?: string;
  icon: string;
  group: "main" | "business" | "system";
  description: string;
};

export type QuickAction = {
  label: string;
  path: string;
  icon: string;
  helper: string;
};

export type QuickActionGroup = {
  title: string;
  actions: QuickAction[];
};

export const mainTabs: AppRoute[] = [
  { path: "/dashboard", label: "Home", icon: gridOutline, group: "main", description: "Dashboard, alerts, profit, and quick actions." },
  { path: "/sites", label: "Sites", icon: businessOutline, group: "main", description: "Site cards, client details, budgets, and progress." },
  { path: "/quick-entry", label: "Add", icon: addCircleOutline, group: "main", description: "One-tap daily entry hub for labour, materials, expenses, payments, progress, and bill scan." },
  { path: "/payments", label: "Money", icon: walletOutline, group: "main", description: "Client payments, pending amount, supplier dues, and profit." },
  { path: "/settings", label: "More", icon: albumsOutline, group: "main", description: "All modules, settings, staff, AI, reports, and health." }
];

export const appRoutes: AppRoute[] = [
  ...mainTabs,
  { path: "/labour", label: "Labour", icon: peopleOutline, group: "business", description: "Labour profiles, wages, advances, and balances." },
  { path: "/attendance", label: "Attendance", icon: calendarOutline, group: "business", description: "Daily attendance, half day, overtime, and wage calculation." },
  { path: "/materials", label: "Materials", icon: cubeOutline, group: "business", description: "Material purchases, bill numbers, supplier mapping, and stock history." },
  { path: "/suppliers", label: "Suppliers", icon: briefcaseOutline, group: "business", description: "Supplier contacts, rates, pending bills, and payment history." },
  { path: "/expenses", label: "Expenses", icon: receiptOutline, group: "business", description: "Daily site expenses, receipts, categories, and monthly summary." },
  { path: "/supplier-payments", label: "Supplier Payments", shortLabel: "Supplier Pay", icon: cashOutline, group: "business", description: "Supplier payment records, bill references, and dues." },
  { path: "/payment-recovery", label: "Payment Recovery", shortLabel: "Recovery", icon: cashOutline, group: "business", description: "Pending client payments, overdue follow-ups, reminders, and WhatsApp recovery messages." },
  { path: "/partner-draws", label: "Partner Draws", shortLabel: "Draws", icon: walletOutline, group: "business", description: "Company money taken by partners, profit sharing, emergency draws, and owner withdrawals." },
  { path: "/partner-ledger", label: "Partner Ledger", shortLabel: "Ledger", icon: walletOutline, group: "business", description: "Partner-wise company cash taken, equal share comparison, and settlement view." },
  { path: "/progress", label: "Site Progress", shortLabel: "Progress", icon: constructOutline, group: "business", description: "Progress timeline, notes, percentages, and photos." },
  { path: "/extra-works", label: "Extra Works", shortLabel: "Extra", icon: constructOutline, group: "business", description: "Variation work, amount increase, client approvals, and unbilled change orders." },
  { path: "/daily-closing", label: "Daily Closing", shortLabel: "Closing", icon: checkmarkDoneOutline, group: "business", description: "End-of-day checklist, daily report, missing entry check, and WhatsApp-ready summary." },
  { path: "/business-brain", label: "Business Brain", shortLabel: "Brain", icon: sparklesOutline, group: "business", description: "Smart control screen for cash, risk, approvals, partner money, and next best actions." },
  { path: "/cash-flow", label: "Cash Flow", shortLabel: "Cash", icon: cashOutline, group: "business", description: "7, 15, and 30 day cash forecast from pending client money, payables, and daily burn." },
  { path: "/approval-center", label: "Approval Center", shortLabel: "Approvals", icon: shieldCheckmarkOutline, group: "business", description: "Approve partner draws, extra work, supplier payments, expenses, and risky decisions." },
  { path: "/bill-scanner", label: "Bill Scanner", shortLabel: "Scanner", icon: receiptOutline, group: "business", description: "Scan supplier bills with OCR and save verified material or expense entries." },
  { path: "/reports", label: "Reports", icon: documentTextOutline, group: "business", description: "Daily, weekly, monthly, site, labour, material, payment, and profit reports." },
  { path: "/automations", label: "Automations", shortLabel: "Auto", icon: analyticsOutline, group: "system", description: "Business autopilot, cashflow radar, next actions, and daily closing checklist." },
  { path: "/market-radar", label: "Market Radar", shortLabel: "Radar", icon: barChartOutline, group: "system", description: "Latest construction-tech capability score and upgrade playbook." },
  { path: "/ai", label: "AI Assistant", shortLabel: "AI", icon: sparklesOutline, group: "system", description: "Ask questions, create drafts, confirm smart entries, and generate summaries." },
  { path: "/memory", label: "Smart Memory", shortLabel: "Memory", icon: heartCircleOutline, group: "system", description: "Business memory, site memory, supplier memory, and AI recall." },
  { path: "/reminders", label: "Reminders", icon: notificationsOutline, group: "system", description: "Payment, attendance, supplier, labour, and custom reminders." },
  { path: "/notifications", label: "Notifications", icon: warningOutline, group: "system", description: "Smart alerts, overdue notices, and system messages." },
  { path: "/staff", label: "Staff", icon: personCircleOutline, group: "system", description: "Admin, staff, viewer roles, and permissions." },
  { path: "/audit", label: "Audit Logs", icon: shieldCheckmarkOutline, group: "system", description: "Who changed what, when, and from which source." },
  { path: "/data-health", label: "Data Health", icon: checkmarkDoneOutline, group: "system", description: "Duplicates, missing site mapping, sync failures, suspicious values, and budget risk." },
  { path: "/settings#supabase-sync", label: "Supabase Sync", shortLabel: "Sync", icon: syncOutline, group: "system", description: "Supabase cloud sync, backup status, laptop and phone data sharing." },
  { path: "/settings", label: "Settings", icon: settingsOutline, group: "system", description: "Company, GST, theme, PDF, sync, backup, and defaults." }
];

export const quickActionGroups: QuickActionGroup[] = [
  {
    title: "Most Used Today",
    actions: [
      { label: "Attendance", path: "/attendance?add=1", icon: calendarOutline, helper: "Present, absent, half day" },
      { label: "Expense", path: "/expenses?add=1", icon: receiptOutline, helper: "Transport, food, site cost" },
      { label: "Material", path: "/materials?add=1", icon: cubeOutline, helper: "Purchase, supplier, bill" },
      { label: "Client Payment", path: "/payments?add=1", icon: walletOutline, helper: "Received and pending" },
      { label: "Progress", path: "/progress?add=1", icon: constructOutline, helper: "Work update and %" },
      { label: "Extra Work", path: "/extra-works?add=1", icon: constructOutline, helper: "Variation and amount increase" }
    ]
  },
  {
    title: "Site Control",
    actions: [
      { label: "Add Site", path: "/sites?add=1", icon: businessOutline, helper: "Client, address, budget" },
      { label: "Labour", path: "/labour?add=1", icon: peopleOutline, helper: "Worker, wage, advance" },
      { label: "Bill Scanner", path: "/bill-scanner", icon: receiptOutline, helper: "OCR bill entry" },
      { label: "Daily Closing", path: "/daily-closing", icon: checkmarkDoneOutline, helper: "End day report" }
    ]
  },
  {
    title: "Money Control",
    actions: [
      { label: "Supplier Pay", path: "/supplier-payments?add=1", icon: cashOutline, helper: "Supplier dues" },
      { label: "Partner Draw", path: "/partner-draws?add=1", icon: cashOutline, helper: "Company money taken" },
      { label: "Recovery", path: "/payment-recovery", icon: cashOutline, helper: "Collect pending money" },
      { label: "Reports", path: "/reports", icon: barChartOutline, helper: "PDF, Excel, CSV" }
    ]
  }
];

export const quickActions = quickActionGroups.flatMap((group) => group.actions);

export const searchIcon = searchOutline;
export const syncIcon = syncOutline;
export const archiveIcon = archiveOutline;
export const fileTrayIcon = fileTrayFullOutline;
export const clipboardIcon = clipboardOutline;
