import {
  albumsOutline,
  analyticsOutline,
  archiveOutline,
  barChartOutline,
  briefcaseOutline,
  businessOutline,
  calendarOutline,
  cashOutline,
  chatbubblesOutline,
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

export const mainTabs: AppRoute[] = [
  { path: "/dashboard", label: "Home", icon: gridOutline, group: "main", description: "Dashboard, alerts, profit, and quick actions." },
  { path: "/sites", label: "Sites", icon: businessOutline, group: "main", description: "Site cards, client details, budgets, and progress." },
  { path: "/labour", label: "Labour", icon: peopleOutline, group: "main", description: "Labour profiles, wages, advances, and balances." },
  { path: "/payments", label: "Finance", icon: walletOutline, group: "main", description: "Client payments, pending amount, supplier dues, and profit." },
  { path: "/settings", label: "More", icon: albumsOutline, group: "main", description: "All modules, settings, staff, AI, reports, and health." }
];

export const appRoutes: AppRoute[] = [
  ...mainTabs,
  { path: "/attendance", label: "Attendance", icon: calendarOutline, group: "business", description: "Daily attendance, half day, overtime, and wage calculation." },
  { path: "/materials", label: "Materials", icon: cubeOutline, group: "business", description: "Material purchases, bill numbers, supplier mapping, and stock history." },
  { path: "/suppliers", label: "Suppliers", icon: briefcaseOutline, group: "business", description: "Supplier contacts, rates, pending bills, and payment history." },
  { path: "/expenses", label: "Expenses", icon: receiptOutline, group: "business", description: "Daily site expenses, receipts, categories, and monthly summary." },
  { path: "/supplier-payments", label: "Supplier Payments", shortLabel: "Supplier Pay", icon: cashOutline, group: "business", description: "Supplier payment records, bill references, and dues." },
  { path: "/progress", label: "Site Progress", shortLabel: "Progress", icon: constructOutline, group: "business", description: "Progress timeline, notes, percentages, and photos." },
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

export const quickActions = [
  { label: "Add Site", path: "/sites?add=1", icon: businessOutline },
  { label: "Attendance", path: "/attendance?add=1", icon: calendarOutline },
  { label: "Material", path: "/materials?add=1", icon: cubeOutline },
  { label: "Expense", path: "/expenses?add=1", icon: receiptOutline },
  { label: "Client Payment", path: "/payments?add=1", icon: walletOutline },
  { label: "Supplier Pay", path: "/supplier-payments?add=1", icon: cashOutline },
  { label: "Progress", path: "/progress?add=1", icon: constructOutline },
  { label: "Report", path: "/reports", icon: barChartOutline }
];

export const searchIcon = searchOutline;
export const syncIcon = syncOutline;
export const archiveIcon = archiveOutline;
export const fileTrayIcon = fileTrayFullOutline;
export const clipboardIcon = clipboardOutline;
