import { describe, expect, it } from "vitest";
import { automationEngine } from "@/utils/automation-engine";
import type { Attendance, ClientPayment, Labour, Material, ProgressUpdate, Site, SupplierPayment } from "@/types/domain";

const base = {
  company_id: "company-1",
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  source: "manual" as const,
  sync_status: "synced" as const,
  idempotency_key: "idem-1",
  archived: false,
  deleted_at: null
};

describe("automationEngine", () => {
  it("creates daily, payment, supplier, and risk actions from business records", () => {
    const sites: Site[] = [
      {
        ...base,
        id: "site-1",
        name: "Kondhwa",
        client_name: "Kumar",
        client_mobile: null,
        address: "Pune",
        work_type: "Waterproofing",
        start_date: "2026-07-01",
        expected_completion_date: "2026-07-05",
        status: "active",
        budget: 1000,
        notes: null,
        progress_percent: 20
      }
    ];
    const labour: Labour[] = [
      {
        ...base,
        id: "labour-1",
        full_name: "Rafiq",
        mobile: null,
        work_type: "Mason",
        default_daily_wage: 700,
        site_id: "site-1",
        advance_payment: 0,
        balance_payment: 500,
        status: "active"
      }
    ];
    const attendance: Attendance[] = [];
    const materials: Material[] = [
      {
        ...base,
        id: "mat-1",
        site_id: "site-1",
        supplier_id: null,
        date: "2026-07-04",
        material_name: "Cement",
        quantity: 20,
        unit: "Bag",
        rate: 100,
        total: 2000,
        supplier_name: "Ramesh",
        supplier_mobile: null,
        bill_number: "B-1",
        bill_photo_url: null,
        payment_status: "unpaid",
        notes: null
      }
    ];
    const payments: ClientPayment[] = [
      { ...base, id: "pay-1", site_id: "site-1", contract_amount: 5000, received_amount: 0, pending_amount: 5000, payment_date: "2026-07-04", payment_mode: "cash", notes: null }
    ];
    const supplierPayments: SupplierPayment[] = [];
    const progress: ProgressUpdate[] = [{ ...base, id: "prog-1", site_id: "site-1", date: "2026-07-01", title: "Started", description: "Started work", progress_percent: 10, ai_summary: null }];

    const result = automationEngine({
      sites,
      labour,
      attendance,
      materials,
      expenses: [],
      payments,
      supplierPayments,
      progress,
      reminders: [],
      today: "2026-07-10"
    });

    expect(result.operatingScore).toBeLessThan(100);
    expect(result.cashflow.pendingClient).toBe(5000);
    expect(result.cashflow.supplierExposure).toBe(2000);
    expect(result.actions.some((item) => item.id === "daily-attendance")).toBe(true);
    expect(result.actions.some((item) => item.id === "supplier-exposure")).toBe(true);
    expect(result.actions.some((item) => item.title.includes("Collect"))).toBe(true);
    expect(result.rules.find((item) => item.id === "daily-attendance-guard")?.status).toBe("active");
  });
});
