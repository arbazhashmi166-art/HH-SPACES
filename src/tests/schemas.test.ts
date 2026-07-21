import { describe, expect, it } from "vitest";
import { resources, type FieldConfig, type ResourceConfig } from "@/config/resources";
import { expenseSchema, loginSchema, siteSchema } from "@/lib/schemas";

function generatedValue(field: FieldConfig) {
  if (field.name === "site_id") return "site_test";
  if (field.name === "labour_id") return "labour_test";
  if (field.name === "supplier_id") return "supplier_test";
  if (field.name === "email") return "qa@example.com";
  if (field.name.includes("mobile") || field.name === "phone") return "9876543210";
  if (field.type === "number") return 1;
  if (field.type === "date") return "2026-07-14";
  if (field.type === "select") return field.options?.[0]?.value || "selected";
  return `QA ${field.label}`;
}

function minimalValues(config: ResourceConfig) {
  const values: Record<string, unknown> = { ...config.defaults() };
  for (const field of config.fields) {
    if (values[field.name] === undefined || values[field.name] === null || values[field.name] === "") {
      values[field.name] = generatedValue(field);
    }
  }
  return values;
}

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
    expect(loginSchema.safeParse({ email: "ARBAZ123", password: "secure-pass-123" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "sahil123", password: "secure-pass-456" }).success).toBe(true);
  });

  it("keeps every resource form config compatible with its schema", () => {
    for (const [key, config] of Object.entries(resources)) {
      const result = (config as ResourceConfig).schema.safeParse(minimalValues(config as ResourceConfig));
      expect(result.success, `${key} form values should parse`).toBe(true);
    }
  });
});
