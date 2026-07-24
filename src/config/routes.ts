import type { LucideIcon } from "lucide-react";
import {
  Album,
  Archive,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CalendarCheck,
  CheckCheck,
  CircleDollarSign,
  CirclePlus,
  ClipboardList,
  FileText,
  Hammer,
  HeartPulse,
  LayoutGrid,
  Menu,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserCircle,
  Users,
  WalletCards,
  WifiSync
} from "lucide-react";

export type AppRoute = {
  path: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  group: "main" | "business" | "system";
  description: string;
};

export type QuickAction = {
  label: string;
  path: string;
  icon: LucideIcon;
  helper: string;
};

export type QuickActionGroup = {
  title: string;
  actions: QuickAction[];
};

export const mainTabs: AppRoute[] = [
  { path: "/dashboard", label: "Home", icon: LayoutGrid, group: "main", description: "Dashboard, alerts, profit, and quick actions." },
  { path: "/sites", label: "Sites", icon: Building2, group: "main", description: "Site cards, client details, budgets, and progress." },
  { path: "/quick-entry", label: "Add", icon: CirclePlus, group: "main", description: "One-tap daily entry hub for labour, materials, expenses, payments, progress, and bill scan." },
  { path: "/payments", label: "Money", icon: WalletCards, group: "main", description: "Client payments, pending amount, supplier dues, and profit." },
  { path: "/settings", label: "More", icon: Menu, group: "main", description: "All modules, settings, staff, AI, reports, and health." }
];

export const appRoutes: AppRoute[] = [
  ...mainTabs,
  { path: "/labour", label: "Labour", icon: Users, group: "business", description: "Labour profiles, wages, advances, and balances." },
  { path: "/attendance", label: "Attendance", icon: CalendarCheck, group: "business", description: "Daily attendance, half day, overtime, and wage calculation." },
  { path: "/materials", label: "Materials", icon: Package, group: "business", description: "Material purchases, bill numbers, supplier mapping, and stock history." },
  { path: "/suppliers", label: "Suppliers", icon: BriefcaseBusiness, group: "business", description: "Supplier contacts, rates, pending bills, and payment history." },
  { path: "/expenses", label: "Expenses", icon: ReceiptText, group: "business", description: "Daily site expenses, receipts, categories, and monthly summary." },
  { path: "/supplier-payments", label: "Supplier Payments", shortLabel: "Supplier Pay", icon: CircleDollarSign, group: "business", description: "Supplier payment records, bill references, and dues." },
  { path: "/payment-recovery", label: "Payment Recovery", shortLabel: "Recovery", icon: CircleDollarSign, group: "business", description: "Pending client payments, overdue follow-ups, reminders, and WhatsApp recovery messages." },
  { path: "/bills", label: "Bills", icon: FileText, group: "business", description: "Client bills, supplier bill scanner, quotations, extra work billing, and billing reports." },
  { path: "/quotations", label: "Quotations", shortLabel: "Quotes", icon: Calculator, group: "business", description: "Customer quotation, BOQ, GST, profit, rate explanation, and rate analyzer." },
  { path: "/partner-draws", label: "Partner Draws", shortLabel: "Draws", icon: WalletCards, group: "business", description: "Company money taken by partners, profit sharing, emergency draws, and owner withdrawals." },
  { path: "/partner-ledger", label: "Partner Ledger", shortLabel: "Ledger", icon: WalletCards, group: "business", description: "Partner-wise company cash taken, equal share comparison, and settlement view." },
  { path: "/progress", label: "Site Progress", shortLabel: "Progress", icon: Hammer, group: "business", description: "Progress timeline, notes, percentages, and photos." },
  { path: "/extra-works", label: "Extra Works", shortLabel: "Extra", icon: Hammer, group: "business", description: "Variation work, amount increase, client approvals, and unbilled change orders." },
  { path: "/daily-closing", label: "Daily Closing", shortLabel: "Closing", icon: CheckCheck, group: "business", description: "End-of-day checklist, daily report, missing entry check, and WhatsApp-ready summary." },
  { path: "/business-brain", label: "Business Brain", shortLabel: "Brain", icon: Sparkles, group: "business", description: "Smart control screen for cash, risk, approvals, partner money, and next best actions." },
  { path: "/cash-flow", label: "Cash Flow", shortLabel: "Cash", icon: CircleDollarSign, group: "business", description: "7, 15, and 30 day cash forecast from pending client money, payables, and daily burn." },
  { path: "/approval-center", label: "Approval Center", shortLabel: "Approvals", icon: ShieldCheck, group: "business", description: "Approve partner draws, extra work, supplier payments, expenses, and risky decisions." },
  { path: "/bill-scanner", label: "Bill Scanner", shortLabel: "Scanner", icon: ReceiptText, group: "business", description: "Scan supplier bills with OCR and save verified material or expense entries." },
  { path: "/reports", label: "Reports", icon: FileText, group: "business", description: "Daily, weekly, monthly, site, labour, material, payment, and profit reports." },
  { path: "/rate-analyzer", label: "Rate Analyzer", shortLabel: "Rates", icon: Calculator, group: "business", description: "Construction market rates, labour/material calculator, BOQ, quotation and profit analyzer." },
  { path: "/automations", label: "Automations", shortLabel: "Auto", icon: BarChart3, group: "system", description: "Business autopilot, cashflow radar, next actions, and daily closing checklist." },
  { path: "/market-radar", label: "Market Radar", shortLabel: "Radar", icon: BarChart3, group: "system", description: "Latest construction-tech capability score and upgrade playbook." },
  { path: "/ai", label: "AI Assistant", shortLabel: "AI", icon: Sparkles, group: "system", description: "Ask questions, create drafts, confirm smart entries, and generate summaries." },
  { path: "/memory", label: "Smart Memory", shortLabel: "Memory", icon: HeartPulse, group: "system", description: "Business memory, site memory, supplier memory, and AI recall." },
  { path: "/reminders", label: "Reminders", icon: Bell, group: "system", description: "Payment, attendance, supplier, labour, and custom reminders." },
  { path: "/notifications", label: "Notifications", icon: TriangleAlert, group: "system", description: "Smart alerts, overdue notices, and system messages." },
  { path: "/staff", label: "Staff", icon: UserCircle, group: "system", description: "Admin, staff, viewer roles, and permissions." },
  { path: "/audit", label: "Audit Logs", icon: ShieldCheck, group: "system", description: "Who changed what, when, and from which source." },
  { path: "/data-health", label: "Data Health", icon: CheckCheck, group: "system", description: "Duplicates, missing site mapping, sync failures, suspicious values, and budget risk." },
  { path: "/settings#supabase-sync", label: "Supabase Sync", shortLabel: "Sync", icon: WifiSync, group: "system", description: "Supabase cloud sync, backup status, laptop and phone data sharing." },
  { path: "/settings", label: "Settings", icon: Settings, group: "system", description: "Company, GST, theme, PDF, sync, backup, and defaults." }
];

export const quickActionGroups: QuickActionGroup[] = [
  {
    title: "Most Used Today",
    actions: [
      { label: "Attendance", path: "/attendance?add=1", icon: CalendarCheck, helper: "Present, absent, half day" },
      { label: "Expense", path: "/expenses?add=1", icon: ReceiptText, helper: "Transport, food, site cost" },
      { label: "Material", path: "/materials?add=1", icon: Package, helper: "Purchase, supplier, bill" },
      { label: "Client Payment", path: "/payments?add=1", icon: WalletCards, helper: "Received and pending" },
      { label: "Progress", path: "/progress?add=1", icon: Hammer, helper: "Work update and %" },
      { label: "Extra Work", path: "/extra-works?add=1", icon: Hammer, helper: "Variation and amount increase" }
    ]
  },
  {
    title: "Site Control",
    actions: [
      { label: "Add Site", path: "/sites?add=1", icon: Building2, helper: "Client, address, budget" },
      { label: "Labour", path: "/labour?add=1", icon: Users, helper: "Worker, wage, advance" },
      { label: "Rate Analyzer", path: "/rate-analyzer", icon: Calculator, helper: "Instant quote and BOQ" },
      { label: "Bill Scanner", path: "/bill-scanner", icon: ReceiptText, helper: "OCR bill entry" },
      { label: "Daily Closing", path: "/daily-closing", icon: CheckCheck, helper: "End day report" }
    ]
  },
  {
    title: "Money Control",
    actions: [
      { label: "Supplier Pay", path: "/supplier-payments?add=1", icon: CircleDollarSign, helper: "Supplier dues" },
      { label: "Partner Draw", path: "/partner-draws?add=1", icon: CircleDollarSign, helper: "Company money taken" },
      { label: "Recovery", path: "/payment-recovery", icon: CircleDollarSign, helper: "Collect pending money" },
      { label: "Reports", path: "/reports", icon: BarChart3, helper: "PDF, Excel, CSV" }
    ]
  }
];

export const quickActions = quickActionGroups.flatMap((group) => group.actions);

export const searchIcon = Search;
export const syncIcon = WifiSync;
export const archiveIcon = Archive;
export const fileTrayIcon = Album;
export const clipboardIcon = ClipboardList;
