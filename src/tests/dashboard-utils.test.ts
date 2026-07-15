import { describe, expect, it } from "vitest";
import { attendanceBreakdown, getDashboardDateRange, getDashboardGreeting, isWithinDateRange } from "@/features/dashboard/dashboard-utils";
import type { Attendance } from "@/types/domain";

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
});
