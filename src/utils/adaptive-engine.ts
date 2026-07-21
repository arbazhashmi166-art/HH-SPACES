import type { AutomationAction } from "./automation-engine";
import type { SmartSeverity } from "./business-logic";
import type { DashboardMetrics } from "@/types/domain";
import { formatMoney } from "./format";

export type AdaptiveDensity = "compact" | "comfortable" | "expanded";

export type AdaptiveCommand = {
  title: string;
  detail: string;
  actionLabel: string;
  route: string;
  severity: SmartSeverity;
  aiPrompt: string;
};

export type AdaptiveShellState = {
  enabled: boolean;
  density: AdaptiveDensity;
  routeMode: "daily" | "money" | "site" | "tools" | "system" | "ai";
  command: AdaptiveCommand;
  shouldHideFloatingAi: boolean;
};

type SyncShape = {
  state?: string;
  label?: string;
  detail?: string;
  pendingCount?: number;
  failedCount?: number;
  online?: boolean;
};

function densityForWidth(width: number): AdaptiveDensity {
  if (width <= 380) return "compact";
  if (width <= 760) return "comfortable";
  return "expanded";
}

function routeMode(pathname: string): AdaptiveShellState["routeMode"] {
  if (pathname.startsWith("/payments") || pathname.startsWith("/supplier-payments") || pathname.startsWith("/cash-flow") || pathname.startsWith("/partner")) {
    return "money";
  }
  if (pathname.startsWith("/sites") || pathname.startsWith("/progress") || pathname.startsWith("/attendance") || pathname.startsWith("/materials") || pathname.startsWith("/labour")) {
    return "site";
  }
  if (pathname.startsWith("/rate-analyzer") || pathname.startsWith("/bill-scanner") || pathname.startsWith("/reports")) {
    return "tools";
  }
  if (pathname.startsWith("/ai") || pathname.startsWith("/business-brain")) return "ai";
  if (pathname.startsWith("/settings") || pathname.startsWith("/data-health") || pathname.startsWith("/audit") || pathname.startsWith("/automations")) {
    return "system";
  }
  return "daily";
}

function shellCommandForRoute(input: {
  pathname: string;
  activeSiteCount: number;
  selectedSiteName: string | null;
  sync: SyncShape;
}): AdaptiveCommand {
  const scope = input.selectedSiteName || "all active sites";
  if (input.sync.failedCount || input.sync.state === "failed" || input.sync.state === "setup_needed") {
    return {
      title: "Fix cloud sync first",
      detail: input.sync.detail || "Some phone entries need retry or Supabase setup before cloud sharing is clean.",
      actionLabel: "Open Sync",
      route: "/settings#supabase-sync",
      severity: "critical",
      aiPrompt: "Explain my current Supabase sync issue in simple steps and tell me what to fix first."
    };
  }

  if (input.activeSiteCount === 0) {
    return {
      title: "Create your first active site",
      detail: "Site selection unlocks cleaner labour, material, payment and progress entries.",
      actionLabel: "Add Site",
      route: "/sites?add=1",
      severity: "warning",
      aiPrompt: "Help me set up my first construction site with the correct fields for daily tracking."
    };
  }

  if (input.pathname.startsWith("/rate-analyzer")) {
    return {
      title: "Use Smart Rate AI here",
      detail: "Type the customer work in plain language and this page builds itemized cost, rate range and BOQ draft.",
      actionLabel: "Analyze Rate",
      route: "/rate-analyzer#smart-rate-ai",
      severity: "info",
      aiPrompt: `Help me prepare a clear customer explanation for a construction rate quotation for ${scope}.`
    };
  }

  if (input.pathname.startsWith("/bill-scanner")) {
    return {
      title: "Verify scanned bill rows",
      detail: "Capture or browse a supplier bill, then save only checked material or expense rows.",
      actionLabel: "Scan Bill",
      route: "/bill-scanner",
      severity: "info",
      aiPrompt: `Guide me through adding a supplier bill safely for ${scope}.`
    };
  }

  if (input.pathname.startsWith("/payments")) {
    return {
      title: "Record or recover payment",
      detail: "Keep received, pending and site-wise receivable clean before sending reminders.",
      actionLabel: "Add Payment",
      route: "/payments?add=1",
      severity: "info",
      aiPrompt: `Create a polite WhatsApp payment follow-up message for ${scope}.`
    };
  }

  if (input.pathname.startsWith("/materials")) {
    return {
      title: "Add material with supplier proof",
      detail: "Use quantity, rate, bill number and photo so reports and stock history stay reliable.",
      actionLabel: "Add Material",
      route: "/materials?add=1",
      severity: "info",
      aiPrompt: `Help me add a material entry for ${scope} with supplier, quantity, rate and payment status.`
    };
  }

  return {
    title: `Best next: add today's work`,
    detail: `Adaptive mode is ready for ${scope}. Add attendance, expense, material, payment or progress in one place.`,
    actionLabel: "Quick Entry",
    route: "/quick-entry",
    severity: "info",
    aiPrompt: `What should I focus on today for ${scope}? Use my app records and give priority actions.`
  };
}

export function adaptiveShellEngine(input: {
  enabled: boolean;
  pathname: string;
  viewportWidth: number;
  activeSiteCount: number;
  selectedSiteName?: string | null;
  sync: SyncShape;
}): AdaptiveShellState {
  const density = densityForWidth(input.viewportWidth || 393);
  const mode = routeMode(input.pathname);
  return {
    enabled: input.enabled,
    density,
    routeMode: mode,
    command: shellCommandForRoute({
      pathname: input.pathname,
      activeSiteCount: input.activeSiteCount,
      selectedSiteName: input.selectedSiteName || null,
      sync: input.sync
    }),
    shouldHideFloatingAi: input.pathname.startsWith("/bill-scanner") || input.pathname.startsWith("/rate-analyzer")
  };
}

function commandFromAutomation(action: AutomationAction): AdaptiveCommand {
  return {
    title: action.title,
    detail: action.description,
    actionLabel: action.primaryAction,
    route: action.route,
    severity: action.severity,
    aiPrompt: `Explain this priority clearly and give me the safest next steps: ${action.title}. ${action.description}`
  };
}

export function adaptiveDashboardEngine(input: {
  activeSiteCount: number;
  selectedSiteName?: string | null;
  metrics: DashboardMetrics;
  periodAttendanceCount: number;
  periodProgressCount: number;
  sync: SyncShape;
  automationActions: AutomationAction[];
}): AdaptiveCommand {
  const scope = input.selectedSiteName || "all active sites";
  if (input.sync.failedCount || input.sync.state === "failed" || input.sync.state === "setup_needed") {
    return {
      title: "Cloud sync needs attention",
      detail: input.sync.detail || "Some records are saved on this phone and need cloud sync retry.",
      actionLabel: "Open Sync",
      route: "/settings#supabase-sync",
      severity: "critical",
      aiPrompt: "Tell me why cloud sync is not clean and give me a simple fix checklist."
    };
  }

  const firstCritical = input.automationActions.find((action) => action.severity === "critical");
  if (firstCritical) return commandFromAutomation(firstCritical);

  if (input.activeSiteCount === 0) {
    return {
      title: "Start with one active site",
      detail: "Create a site so labour, materials, payments, progress and reports do not get mixed.",
      actionLabel: "Add Site",
      route: "/sites?add=1",
      severity: "warning",
      aiPrompt: "Help me create a clean construction site setup for H&H SPACES."
    };
  }

  if (input.periodAttendanceCount === 0) {
    return {
      title: "Mark attendance now",
      detail: `No attendance is saved for ${scope}. Labour cost and daily report will stay incomplete.`,
      actionLabel: "Attendance",
      route: "/attendance?add=1",
      severity: "warning",
      aiPrompt: `Prepare an attendance entry checklist for ${scope}.`
    };
  }

  if (input.metrics.pendingClientPayments > 0) {
    return {
      title: "Collect client payment",
      detail: `${formatMoney(input.metrics.pendingClientPayments)} is outstanding. Follow up before adding more payable load.`,
      actionLabel: "Payment",
      route: "/payment-recovery",
      severity: input.metrics.pendingClientPayments > 100000 ? "critical" : "warning",
      aiPrompt: `Write a professional WhatsApp payment reminder for ${formatMoney(input.metrics.pendingClientPayments)} pending at ${scope}.`
    };
  }

  const firstAutomation = input.automationActions[0];
  if (firstAutomation) return commandFromAutomation(firstAutomation);

  if (input.periodProgressCount === 0) {
    return {
      title: "Add progress proof",
      detail: `No progress update is saved for ${scope}. Add work notes or photos before closing the day.`,
      actionLabel: "Progress",
      route: "/progress?add=1",
      severity: "warning",
      aiPrompt: `Help me write a short daily progress update for ${scope}.`
    };
  }

  return {
    title: "Close the day cleanly",
    detail: "Attendance, money, progress and reports look ready for a daily closing review.",
    actionLabel: "Daily Closing",
    route: "/daily-closing",
    severity: "info",
    aiPrompt: `Generate a daily closing summary for ${scope} using my records.`
  };
}
