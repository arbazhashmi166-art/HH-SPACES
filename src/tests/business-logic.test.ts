import { describe, expect, it } from "vitest";
import { businessIntelligence } from "@/utils/business-logic";
import type { Attendance, ClientPayment, Expense, Material, ProgressUpdate, Site, SupplierPayment } from "@/types/domain";

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

describe("businessIntelligence", () => {
  it("scores over-budget delayed sites and creates focus actions", () => {
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
    const attendance: Attendance[] = [
      { ...base, id: "att-1", site_id: "site-1", labour_id: "labour-1", date: "2026-07-04", status: "present", overtime_hours: 0, daily_wage: 700, wage_amount: 700, notes: null }
    ];
    const materials: Material[] = [
      {
        ...base,
        id: "mat-1",
        site_id: "site-1",
        supplier_id: null,
        date: "2026-07-04",
        material_name: "Cement",
        quantity: 10,
        unit: "Bag",
        rate: 100,
        total: 1000,
        supplier_name: null,
        supplier_mobile: null,
        bill_number: null,
        bill_photo_url: null,
        payment_status: "unpaid",
        notes: null
      }
    ];
    const expenses: Expense[] = [];
    const payments: ClientPayment[] = [
      { ...base, id: "pay-1", site_id: "site-1", contract_amount: 5000, received_amount: 0, pending_amount: 5000, payment_date: "2026-07-04", payment_mode: "cash", notes: null }
    ];
    const supplierPayments: SupplierPayment[] = [];
    const progress: ProgressUpdate[] = [{ ...base, id: "prog-1", site_id: "site-1", date: "2026-07-01", title: "Started", description: "Started work", progress_percent: 10, ai_summary: null }];

    const result = businessIntelligence({ sites, attendance, materials, expenses, payments, supplierPayments, progress, today: "2026-07-10" });

    const health = result.siteHealth[0];
    expect(health).toBeDefined();
    expect(health?.riskLevel).toBe("critical");
    expect(health?.budgetUsedPercent).toBe(170);
    expect(result.focusActions.some((item) => item.title.includes("Collect payment"))).toBe(true);
    expect(result.focusActions.some((item) => item.title.includes("Review delayed site"))).toBe(true);
  });
});
