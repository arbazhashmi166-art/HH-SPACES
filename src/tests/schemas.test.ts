import { describe, expect, it } from "vitest";
import { expenseSchema, loginSchema, siteSchema } from "@/lib/schemas";

describe("schemas", () => {
  it("rejects negative money", () => {
    const result = expenseSchema.safeParse({
      date: "2026-07-01",
      category: "transport",
      amount: -1,
      payment_mode: "cash"
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid site", () => {
    const result = siteSchema.safeParse({
      name: "Kondhwa",
      client_name: "Kumar",
      client_mobile: "9876543210",
      address: "Pune",
      work_type: "Waterproofing",
      start_date: "2026-07-01",
      expected_completion_date: "2026-07-20",
      status: "active",
      budget: 100000,
      notes: "",
      progress_percent: 10
    });
    expect(result.success).toBe(true);
  });

  it("accepts approved username login as well as email login", () => {
    expect(loginSchema.safeParse({ email: "ARBAZ123", password: "BUCKY1081" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "sahil123", password: "DAVID9529" }).success).toBe(true);
  });
});
