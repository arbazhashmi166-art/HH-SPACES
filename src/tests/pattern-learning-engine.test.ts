import { describe, expect, test } from "vitest";
import type { Attendance, BaseRecord, ClientPayment, Expense, Labour, Material, ProgressUpdate, Site, SupplierPayment } from "@/types/domain";
import { businessPatternLearning } from "@/utils/pattern-learning-engine";

const baseRecord = (id: string): BaseRecord => ({
  id,
  company_id: "company-1",
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-07-20T08:00:00+05:30",
  updated_at: "2026-07-20T08:00:00+05:30",
  source: "manual",
  sync_status: "synced",
  idempotency_key: `${id}-key`,
  archived: false,
  deleted_at: null
});

const activeSite = (id: string, name: string): Site => ({
  ...baseRecord(id),
  name,
  client_name: "Client",
  client_mobile: "9000000000",
  address: "Pune",
  work_type: "Interior",
  start_date: "2026-07-01",
  expected_completion_date: "2026-08-01",
  status: "active",
  budget: 500000,
  notes: null,
  progress_percent: 40
});

const material = (id: string, rate: number, date: string): Material => ({
  ...baseRecord(id),
  updated_at: `${date}T09:00:00+05:30`,
  site_id: "site-1",
  supplier_id: null,
  date,
  material_name: "Cement",
  quantity: 10,
  unit: "bag",
  rate,
  total: rate * 10,
  supplier_name: "Ramesh",
  supplier_mobile: null,
  bill_number: null,
  bill_photo_url: null,
  payment_status: "unpaid",
  notes: null
});

describe("business pattern learning", () => {
  test("learns the most active site and suggests attendance when today is missing", () => {
    const result = businessPatternLearning({
      today: "2026-07-23",
      sites: [activeSite("site-1", "Shivneri")],
      labour: [],
      attendance: [],
      materials: [material("material-1", 360, "2026-07-22")],
      expenses: [],
      payments: [],
      supplierPayments: [],
      progress: []
    });

    expect(result.defaultSiteId).toBe("site-1");
    expect(result.patterns.map((pattern) => pattern.id)).toContain("default-site");
    expect(result.patterns.map((pattern) => pattern.id)).toContain("attendance-missing");
    expect(result.patterns.find((pattern) => pattern.id === "attendance-missing")?.route).toContain("siteId=site-1");
  });

  test("does not suggest missing attendance when attendance exists for the learned site", () => {
    const attendance: Attendance = {
      ...baseRecord("attendance-1"),
      site_id: "site-1",
      labour_id: "labour-1",
      date: "2026-07-23",
      status: "present",
      overtime_hours: 0,
      daily_wage: 800,
      wage_amount: 800,
      notes: null
    };

    const result = businessPatternLearning({
      today: "2026-07-23",
      sites: [activeSite("site-1", "Shivneri")],
      labour: [],
      attendance: [attendance],
      materials: [],
      expenses: [],
      payments: [],
      supplierPayments: [],
      progress: []
    });

    expect(result.patterns.map((pattern) => pattern.id)).not.toContain("attendance-missing");
  });

  test("flags material rate jumps from saved purchase history", () => {
    const result = businessPatternLearning({
      today: "2026-07-23",
      sites: [activeSite("site-1", "Shivneri")],
      labour: [],
      attendance: [],
      materials: [material("material-1", 300, "2026-07-20"), material("material-2", 390, "2026-07-23")],
      expenses: [],
      payments: [],
      supplierPayments: [],
      progress: []
    });

    const rateMemory = result.patterns.find((pattern) => pattern.id === "material-rate-memory");

    expect(rateMemory?.tone).toBe("warning");
    expect(rateMemory?.message).toContain("above");
    expect(rateMemory?.message).toContain("average");
  });

  test("learns common expense, labour rate and money follow-up from real records", () => {
    const expense: Expense = {
      ...baseRecord("expense-1"),
      site_id: "site-1",
      date: "2026-07-22",
      category: "transport",
      amount: 2500,
      payment_mode: "cash",
      notes: null,
      receipt_photo_url: null
    };
    const labour: Labour = {
      ...baseRecord("labour-1"),
      full_name: "Sameer",
      mobile: null,
      work_type: "Tile mason",
      default_daily_wage: 1000,
      site_id: "site-1",
      advance_payment: 0,
      balance_payment: 0,
      status: "active"
    };
    const payment: ClientPayment = {
      ...baseRecord("payment-1"),
      site_id: "site-1",
      contract_amount: 100000,
      received_amount: 25000,
      pending_amount: 75000,
      payment_date: "2026-07-22",
      payment_mode: "upi",
      notes: null
    };
    const supplierPayment: SupplierPayment = {
      ...baseRecord("supplier-payment-1"),
      supplier_id: "supplier-1",
      site_id: "site-1",
      paid_amount: 10000,
      pending_amount: 5000,
      payment_date: "2026-07-22",
      payment_mode: "bank_transfer",
      bill_reference: null,
      notes: null
    };
    const progress: ProgressUpdate = {
      ...baseRecord("progress-1"),
      site_id: "site-1",
      date: "2026-07-22",
      title: "Tile work",
      description: "Bathroom wall tile completed",
      progress_percent: 55,
      ai_summary: null
    };

    const result = businessPatternLearning({
      today: "2026-07-23",
      sites: [activeSite("site-1", "Shivneri")],
      labour: [labour],
      attendance: [],
      materials: [],
      expenses: [expense],
      payments: [payment],
      supplierPayments: [supplierPayment],
      progress: [progress]
    });

    expect(result.patterns.map((pattern) => pattern.id)).toEqual(
      expect.arrayContaining(["expense-pattern", "labour-rate-memory", "money-follow-up"])
    );
    expect(result.patterns.find((pattern) => pattern.id === "money-follow-up")?.message).toContain("75,000");
  });

  test("shows a clear learning-start state when no business records exist", () => {
    const result = businessPatternLearning({
      today: "2026-07-23",
      sites: [],
      labour: [],
      attendance: [],
      materials: [],
      expenses: [],
      payments: [],
      supplierPayments: [],
      progress: []
    });

    expect(result.defaultSiteId).toBeNull();
    expect(result.recordCount).toBe(0);
    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0]?.id).toBe("learning-start");
  });
});
