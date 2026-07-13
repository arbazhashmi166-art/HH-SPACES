import type {
  AiMessage,
  Attendance,
  ClientPayment,
  Expense,
  ExtraWork,
  Labour,
  Material,
  ProgressPhoto,
  ProgressUpdate,
  Reminder,
  Site,
  Supplier,
  SupplierPayment
} from "@/types/domain";
import { automationEngine } from "./automation-engine";
import { businessIntelligence } from "./business-logic";

export type MarketCapabilityStatus = "active" | "partial" | "needs-setup";

export type MarketCapability = {
  id: string;
  title: string;
  marketSignal: string;
  businessValue: string;
  status: MarketCapabilityStatus;
  powerScore: number;
  route: string;
  actionLabel: string;
};

export type MarketPlaybookItem = {
  title: string;
  description: string;
  cadence: "daily" | "weekly" | "monthly";
  route: string;
};

export type MarketRadarResult = {
  marketPowerScore: number;
  headline: string;
  capabilities: MarketCapability[];
  playbook: MarketPlaybookItem[];
};

function statusFromScore(score: number): MarketCapabilityStatus {
  if (score >= 75) return "active";
  if (score >= 35) return "partial";
  return "needs-setup";
}

function headline(score: number) {
  if (score >= 82) return "Modern contractor OS";
  if (score >= 62) return "Strong field system";
  if (score >= 42) return "Good foundation";
  return "Start entering daily data";
}

export function marketRadar(input: {
  sites: Site[];
  labour: Labour[];
  attendance: Attendance[];
  materials: Material[];
  suppliers: Supplier[];
  expenses: Expense[];
  payments: ClientPayment[];
  supplierPayments: SupplierPayment[];
  progress: ProgressUpdate[];
  progressPhotos: ProgressPhoto[];
  extraWorks?: ExtraWork[];
  reminders: Reminder[];
  aiMessages: AiMessage[];
}): MarketRadarResult {
  const automation = automationEngine(input);
  const intelligence = businessIntelligence(input);
  const hasDailyData = input.attendance.length + input.materials.length + input.expenses.length + input.progress.length > 0;
  const hasFinancialData = input.payments.length + input.supplierPayments.length + input.expenses.length + input.materials.length > 0;
  const hasSupplierData = input.suppliers.length + input.materials.length + input.supplierPayments.length > 0;
  const hasPhotoProof = input.progressPhotos.length > 0 || input.progress.some((item) => item.description.toLowerCase().includes("photo"));
  const hasExtraWorkControl = (input.extraWorks || []).length > 0;
  const unbilledExtraWorks = automation.cashflow.unbilledExtraWorks;
  const highRiskSites = intelligence.siteHealth.filter((site) => site.riskLevel !== "info").length;
  const openAutomationActions = automation.actions.length;

  const capabilities: MarketCapability[] = [
    {
      id: "ai-field-copilot",
      title: "AI Field Copilot",
      marketSignal: "AI is moving into daily reporting, field questions, summaries, and decision support.",
      businessValue: "Ask business questions, create drafts, and reduce manual report writing.",
      status: statusFromScore(input.aiMessages.length ? 88 : 56),
      powerScore: input.aiMessages.length ? 88 : 56,
      route: "/ai",
      actionLabel: "Ask AI"
    },
    {
      id: "predictive-risk",
      title: "Predictive Site Risk",
      marketSignal: "Modern systems warn before budget, progress, payment, or schedule risk becomes expensive.",
      businessValue: highRiskSites ? `${highRiskSites} site risk signals need review.` : "Budget, payment, and delay risk engine is watching your sites.",
      status: statusFromScore(input.sites.length && hasDailyData ? 92 : input.sites.length ? 48 : 18),
      powerScore: input.sites.length && hasDailyData ? 92 : input.sites.length ? 48 : 18,
      route: "/automations",
      actionLabel: "Open Auto"
    },
    {
      id: "mobile-field-data",
      title: "Mobile Field Data Capture",
      marketSignal: "Field teams now capture attendance, costs, photos, and progress from the phone instead of later paperwork.",
      businessValue: hasDailyData ? "Daily site records are flowing into the app." : "Start with attendance, material, expense, and progress entries.",
      status: statusFromScore(hasDailyData ? 86 : 24),
      powerScore: hasDailyData ? 86 : 24,
      route: "/attendance?add=1",
      actionLabel: "Add Daily Data"
    },
    {
      id: "photo-proof",
      title: "Photo Proof Timeline",
      marketSignal: "Progress photos and before/after proof reduce client disputes and improve reporting.",
      businessValue: hasPhotoProof ? "Photo/progress proof is available for reporting." : "Add site progress photos and notes for proof of work.",
      status: statusFromScore(hasPhotoProof ? 82 : input.progress.length ? 45 : 16),
      powerScore: hasPhotoProof ? 82 : input.progress.length ? 45 : 16,
      route: "/progress?add=1",
      actionLabel: "Add Proof"
    },
    {
      id: "procurement-control",
      title: "Procurement and Supplier Control",
      marketSignal: "The market is automating supplier follow-up, material bills, and payment reconciliation.",
      businessValue: hasSupplierData ? "Supplier/material/payment records can be tracked together." : "Add suppliers and material bills to control procurement.",
      status: statusFromScore(hasSupplierData ? 78 : 20),
      powerScore: hasSupplierData ? 78 : 20,
      route: "/suppliers",
      actionLabel: "Open Suppliers"
    },
    {
      id: "cashflow-recovery",
      title: "Cashflow Recovery Engine",
      marketSignal: "Contractor software is becoming more finance-led: receivables, dues, burn rate, and reminders.",
      businessValue: automation.cashflow.pendingClient
        ? `Client pending is ${Math.round(automation.cashflow.pendingClient).toLocaleString("en-IN")}.`
        : "Payment collector is ready when receivables are entered.",
      status: statusFromScore(hasFinancialData ? 84 : 30),
      powerScore: hasFinancialData ? 84 : 30,
      route: "/payments",
      actionLabel: "Open Finance"
    },
    {
      id: "automated-reports",
      title: "Automated Reports Pack",
      marketSignal: "PDF/Excel reports, daily summaries, and client-ready exports are becoming standard.",
      businessValue: "Daily, site risk, automation, payment, labour, material, and profit reports can be exported.",
      status: "active",
      powerScore: 88,
      route: "/reports",
      actionLabel: "Export Reports"
    },
    {
      id: "change-order-control",
      title: "Variation and Change Control",
      marketSignal: "Extra work must be captured early so billing does not leak.",
      businessValue: unbilledExtraWorks
        ? `Approved unbilled extra work is ${Math.round(unbilledExtraWorks).toLocaleString("en-IN")}.`
        : "Dedicated extra work tracking is ready for change orders and amount increases.",
      status: statusFromScore(hasExtraWorkControl ? 86 : 42),
      powerScore: hasExtraWorkControl ? 86 : 42,
      route: "/extra-works?add=1",
      actionLabel: "Add Extra Work"
    }
  ];

  const marketPowerScore = Math.round(capabilities.reduce((total, item) => total + item.powerScore, 0) / capabilities.length);
  const urgentAutomation = automation.actions[0];
  const playbook: MarketPlaybookItem[] = [
    {
      title: "Morning control check",
      description: urgentAutomation ? urgentAutomation.title : "Open Business Autopilot and check cash pressure before site work starts.",
      cadence: "daily",
      route: urgentAutomation?.route || "/automations"
    },
    {
      title: "End-of-day proof pack",
      description: "Save attendance, costs, progress notes, and photos before leaving the site.",
      cadence: "daily",
      route: "/progress?add=1"
    },
    {
      title: "Weekly payment recovery",
      description: "Export payment and automation reports, then follow up clients and suppliers.",
      cadence: "weekly",
      route: "/reports"
    },
    {
      title: "Monthly profit review",
      description: "Compare site cost, received amount, pending amount, supplier exposure, and profit/loss.",
      cadence: "monthly",
      route: "/reports"
    }
  ];

  return {
    marketPowerScore,
    headline: headline(marketPowerScore),
    capabilities: capabilities.sort((a, b) => a.powerScore - b.powerScore),
    playbook
  };
}
