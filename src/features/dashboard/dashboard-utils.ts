import type { Attendance, Site } from "@/types/domain";

export type DashboardDatePreset = "today" | "yesterday" | "this_week" | "this_month";

export type DashboardDateRange = {
  preset: DashboardDatePreset;
  label: string;
  heading: string;
  from: string;
  to: string;
};

export function getDashboardGreeting(profileName?: string | null, metadataName?: unknown, date = new Date()) {
  const hour = date.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const metadataDisplayName = typeof metadataName === "string" ? metadataName.trim() : "";
  const displayName = profileName?.trim() || metadataDisplayName || "there";
  const dateLabel = date.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" });

  return { greeting, displayName, dateLabel };
}

export function getDashboardDateRange(preset: DashboardDatePreset, now = new Date()): DashboardDateRange {
  const today = startOfDay(now);
  if (preset === "yesterday") {
    const yesterday = addDays(today, -1);
    return { preset, label: "Yesterday", heading: "Yesterday", from: localIsoDate(yesterday), to: localIsoDate(yesterday) };
  }
  if (preset === "this_week") {
    const day = today.getDay() || 7;
    const start = addDays(today, 1 - day);
    return { preset, label: "This week", heading: "This Week", from: localIsoDate(start), to: localIsoDate(today) };
  }
  if (preset === "this_month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { preset, label: "This month", heading: "This Month", from: localIsoDate(start), to: localIsoDate(today) };
  }
  return { preset, label: "Today", heading: "Today", from: localIsoDate(today), to: localIsoDate(today) };
}

export function isWithinDateRange(value: string | null | undefined, range: Pick<DashboardDateRange, "from" | "to">) {
  if (!value) return false;
  return value >= range.from && value <= range.to;
}

export function attendanceBreakdown(rows: Attendance[]) {
  const present = rows.filter((row) => row.status === "present").length;
  const halfDay = rows.filter((row) => row.status === "half_day").length;
  const absent = rows.filter((row) => row.status === "absent").length;
  return {
    present,
    halfDay,
    absent,
    total: rows.length,
    effectivePresent: present + halfDay * 0.5
  };
}

export function isOpenDashboardSite(site: Pick<Site, "status">) {
  return site.status !== "completed";
}

export function scopeSitesForDashboard(sites: Site[], selectedSiteId: string) {
  if (selectedSiteId) return sites.filter((site) => site.id === selectedSiteId);
  return sites.filter(isOpenDashboardSite);
}

export function scopeSiteRowsForDashboard<T extends { site_id?: string | null }>(rows: T[], selectedSiteId: string, openSiteIds: Set<string>) {
  if (selectedSiteId) return rows.filter((row) => row.site_id === selectedSiteId);
  return rows.filter((row) => !row.site_id || openSiteIds.has(row.site_id));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
