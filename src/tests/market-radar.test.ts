import { describe, expect, it } from "vitest";
import { marketRadar } from "@/utils/market-radar";
import type { Attendance, ClientPayment, Material, ProgressUpdate, Site, Supplier } from "@/types/domain";

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

describe("marketRadar", () => {
  it("scores modern construction capabilities from saved business data", () => {
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
        expected_completion_date: "2026-07-30",
        status: "active",
        budget: 100000,
        notes: null,
        progress_percent: 40
      }
    ];
    const attendance: Attendance[] = [
      { ...base, id: "att-1", site_id: "site-1", labour_id: "labour-1", date: "2026-07-10", status: "present", overtime_hours: 0, daily_wage: 700, wage_amount: 700, notes: null }
    ];
    const suppliers: Supplier[] = [{ ...base, id: "supplier-1", name: "Ramesh", mobile: null, material_type: "Cement", address: null }];
    const materials: Material[] = [
      {
        ...base,
        id: "mat-1",
        site_id: "site-1",
        supplier_id: "supplier-1",
        date: "2026-07-10",
        material_name: "Cement",
        quantity: 10,
        unit: "Bag",
        rate: 360,
        total: 3600,
        supplier_name: "Ramesh",
        supplier_mobile: null,
        bill_number: "B-1",
        bill_photo_url: null,
        payment_status: "paid",
        notes: null
      }
    ];
    const payments: ClientPayment[] = [
      { ...base, id: "payment-1", site_id: "site-1", contract_amount: 100000, received_amount: 25000, pending_amount: 75000, payment_date: "2026-07-10", payment_mode: "cash", notes: null }
    ];
    const progress: ProgressUpdate[] = [
      { ...base, id: "progress-1", site_id: "site-1", date: "2026-07-10", title: "Photo proof", description: "Photo uploaded after waterproofing work", progress_percent: 40, ai_summary: null }
    ];

    const result = marketRadar({
      sites,
      labour: [],
      attendance,
      materials,
      suppliers,
      expenses: [],
      payments,
      supplierPayments: [],
      progress,
      progressPhotos: [],
      reminders: [],
      aiMessages: []
    });

    expect(result.marketPowerScore).toBeGreaterThan(50);
    expect(result.capabilities.some((item) => item.id === "photo-proof" && item.status === "active")).toBe(true);
    expect(result.capabilities.some((item) => item.id === "cashflow-recovery" && item.status === "active")).toBe(true);
    expect(result.playbook).toHaveLength(4);
  });
});
