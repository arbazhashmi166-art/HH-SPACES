import { describe, expect, it } from "vitest";
import { adaptiveDashboardEngine, adaptiveShellEngine } from "@/utils/adaptive-engine";
import type { DashboardMetrics } from "@/types/domain";

const baseMetrics: DashboardMetrics = {
  activeSites: 1,
  todayLabourCost: 0,
  todayMaterialCost: 0,
  todayExpenses: 0,
  pendingClientPayments: 0,
  pendingSupplierPayments: 0,
  labourAdvanceBalance: 0,
  monthlyIncome: 0,
  monthlyExpense: 0,
  estimatedProfit: 0,
  approvedExtraWorks: 0,
  unbilledExtraWorks: 0,
  partnerDrawsTotal: 0
};

describe("adaptiveShellEngine", () => {
  it("prioritizes broken sync above route shortcuts", () => {
    const state = adaptiveShellEngine({
      enabled: true,
      pathname: "/materials",
      viewportWidth: 393,
      activeSiteCount: 2,
      selectedSiteName: "Shivneri",
      sync: { state: "failed", failedCount: 1, detail: "1 sync failed" }
    });

    expect(state.command.route).toBe("/settings#supabase-sync");
    expect(state.command.severity).toBe("critical");
  });

  it("uses compact density and hides floating AI on the rate analyzer", () => {
    const state = adaptiveShellEngine({
      enabled: true,
      pathname: "/rate-analyzer/",
      viewportWidth: 360,
      activeSiteCount: 1,
      selectedSiteName: null,
      sync: { state: "synced", failedCount: 0 }
    });

    expect(state.density).toBe("compact");
    expect(state.routeMode).toBe("tools");
    expect(state.shouldHideFloatingAi).toBe(true);
    expect(state.command.title).toContain("Smart Rate AI");
  });
});

describe("adaptiveDashboardEngine", () => {
  it("asks the user to mark attendance when daily attendance is missing", () => {
    const command = adaptiveDashboardEngine({
      activeSiteCount: 1,
      selectedSiteName: "Kondhwa",
      metrics: baseMetrics,
      periodAttendanceCount: 0,
      periodProgressCount: 1,
      sync: { state: "synced", failedCount: 0 },
      automationActions: []
    });

    expect(command.route).toBe("/attendance?add=1");
    expect(command.actionLabel).toBe("Attendance");
  });

  it("switches to payment recovery when attendance is done and receivable is open", () => {
    const command = adaptiveDashboardEngine({
      activeSiteCount: 1,
      metrics: { ...baseMetrics, pendingClientPayments: 125000 },
      periodAttendanceCount: 3,
      periodProgressCount: 1,
      sync: { state: "synced", failedCount: 0 },
      automationActions: []
    });

    expect(command.route).toBe("/payment-recovery");
    expect(command.severity).toBe("critical");
  });
});
