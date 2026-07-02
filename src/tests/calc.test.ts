import { describe, expect, it } from "vitest";
import { dashboardMetrics } from "@/utils/calc";

describe("dashboardMetrics", () => {
  it("separates income, labour, material, expenses, and pending amounts", () => {
    const today = new Date().toISOString().slice(0, 10);
    const metrics = dashboardMetrics({
      sites: [
        {
          id: "s1",
          company_id: "c1",
          name: "A",
          client_name: "Client",
          client_mobile: null,
          address: "Addr",
          work_type: "POP",
          start_date: today,
          expected_completion_date: null,
          status: "active",
          budget: 100000,
          notes: null,
          progress_percent: 20,
          created_by: null,
          updated_by: null,
          created_at: today,
          updated_at: today,
          source: "manual",
          sync_status: "synced",
          idempotency_key: "i1",
          archived: false,
          deleted_at: null
        }
      ],
      labour: [],
      attendance: [
        {
          id: "a1",
          company_id: "c1",
          site_id: "s1",
          labour_id: "l1",
          date: today,
          status: "present",
          overtime_hours: 0,
          daily_wage: 700,
          wage_amount: 700,
          notes: null,
          created_by: null,
          updated_by: null,
          created_at: today,
          updated_at: today,
          source: "manual",
          sync_status: "synced",
          idempotency_key: "i2",
          archived: false,
          deleted_at: null
        }
      ],
      materials: [
        {
          id: "m1",
          company_id: "c1",
          site_id: "s1",
          supplier_id: null,
          date: today,
          material_name: "Cement",
          quantity: 10,
          unit: "Bags",
          rate: 360,
          total: 3600,
          supplier_name: null,
          supplier_mobile: null,
          bill_number: null,
          bill_photo_url: null,
          payment_status: "unpaid",
          notes: null,
          created_by: null,
          updated_by: null,
          created_at: today,
          updated_at: today,
          source: "manual",
          sync_status: "synced",
          idempotency_key: "i3",
          archived: false,
          deleted_at: null
        }
      ],
      expenses: [
        {
          id: "e1",
          company_id: "c1",
          site_id: "s1",
          date: today,
          category: "transport",
          amount: 500,
          payment_mode: "cash",
          notes: null,
          receipt_photo_url: null,
          created_by: null,
          updated_by: null,
          created_at: today,
          updated_at: today,
          source: "manual",
          sync_status: "synced",
          idempotency_key: "i4",
          archived: false,
          deleted_at: null
        }
      ],
      payments: [
        {
          id: "p1",
          company_id: "c1",
          site_id: "s1",
          contract_amount: 100000,
          received_amount: 10000,
          pending_amount: 90000,
          payment_date: today,
          payment_mode: "upi",
          notes: null,
          created_by: null,
          updated_by: null,
          created_at: today,
          updated_at: today,
          source: "manual",
          sync_status: "synced",
          idempotency_key: "i5",
          archived: false,
          deleted_at: null
        }
      ],
      supplierPayments: []
    });

    expect(metrics.activeSites).toBe(1);
    expect(metrics.todayLabourCost).toBe(700);
    expect(metrics.todayMaterialCost).toBe(3600);
    expect(metrics.todayExpenses).toBe(500);
    expect(metrics.pendingClientPayments).toBe(90000);
    expect(metrics.estimatedProfit).toBe(5200);
  });
});
