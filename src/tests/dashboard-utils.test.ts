import { describe, expect, it } from "vitest";
import {
  attendanceBreakdown,
  getDashboardDateRange,
  getDashboardGreeting,
  isWithinDateRange,
  scopeSiteRowsForDashboard,
  scopeSitesForDashboard
} from "@/features/dashboard/dashboard-utils";
import type { Attendance, Site } from "@/types/domain";

const baseAttendance: Attendance = {
  id: "a1",
  company_id: "c1",
  site_id: "s1",
  labour_id: "l1",
  date: "2026-07-15",
  status: "present",
  overtime_hours: 0,
  daily_wage: 700,
  wage_amount: 700,
  notes: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-07-15T08:00:00.000Z",
  updated_at: "2026-07-15T08:00:00.000Z",
  source: "manual",
  sync_status: "synced",
  idempotency_key: "i1",
  archived: false,
  deleted_at: null
};

const baseSite: Site = {
  id: "s1",
  company_id: "c1",
  name: "Open Site",
  client_name: "Client",
  client_mobile: null,
  address: "Address",
  work_type: "POP",
  start_date: "2026-07-15",
  expected_completion_date: null,
  status: "active",
  budget: 100000,
  notes: null,
  progress_percent: 40,
  created_by: null,
  updated_by: null,
  created_at: "2026-07-15T08:00:00.000Z",
  updated_at: "2026-07-15T08:00:00.000Z",
  source: "manual",
  sync_status: "synced",
  idempotency_key: "site-1",
  archived: false,
  deleted_at: null
};

describe("dashboard utilities", () => {
  it("uses profile or metadata name and time-aware greeting", () => {
    expect(getDashboardGreeting("Arbaz", "Other", new Date("2026-07-15T09:00:00")).greeting).toBe("Good morning");
    expect(getDashboardGreeting(null, "Supervisor", new Date("2026-07-15T14:00:00")).displayName).toBe("Supervisor");
    expect(getDashboardGreeting(null, null, new Date("2026-07-15T20:00:00")).displayName).toBe("there");
  });

  it("builds local dashboard date ranges", () => {
    const range = getDashboardDateRange("yesterday", new Date("2026-07-15T10:00:00"));
    expect(range.from).toBe("2026-07-14");
    expect(range.to).toBe("2026-07-14");
    expect(isWithinDateRange("2026-07-14", range)).toBe(true);
    expect(isWithinDateRange("2026-07-15", range)).toBe(false);
  });

  it("separates present, half-day, absent, and effective labour counts", () => {
    const rows: Attendance[] = [
      baseAttendance,
      { ...baseAttendance, id: "a2", labour_id: "l2", status: "half_day", wage_amount: 350 },
      { ...baseAttendance, id: "a3", labour_id: "l3", status: "absent", wage_amount: 0 }
    ];
    expect(attendanceBreakdown(rows)).toEqual({
      present: 1,
      halfDay: 1,
      absent: 1,
      total: 3,
      effectivePresent: 1.5
    });
  });

  it("scopes all-sites dashboard data to open sites and company-level rows", () => {
    const sites: Site[] = [
      baseSite,
      { ...baseSite, id: "s2", name: "Completed Site", status: "completed", idempotency_key: "site-2" },
      { ...baseSite, id: "s3", name: "Paused Site", status: "paused", idempotency_key: "site-3" }
    ];

    expect(scopeSitesForDashboard(sites, "").map((site) => site.id)).toEqual(["s1", "s3"]);
    expect(scopeSitesForDashboard(sites, "s2").map((site) => site.id)).toEqual(["s2"]);

    const openSiteIds = new Set(scopeSitesForDashboard(sites, "").map((site) => site.id));
    const rows = [
      { id: "active-row", site_id: "s1" },
      { id: "completed-row", site_id: "s2" },
      { id: "company-row", site_id: null }
    ];

    expect(scopeSiteRowsForDashboard(rows, "", openSiteIds).map((row) => row.id)).toEqual(["active-row", "company-row"]);
    expect(scopeSiteRowsForDashboard(rows, "s2", openSiteIds).map((row) => row.id)).toEqual(["completed-row"]);
  });
});
