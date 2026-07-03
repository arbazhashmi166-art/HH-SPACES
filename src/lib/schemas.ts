import { z } from "zod";

export const money = z.coerce.number().min(0, "Money values cannot be negative").finite("Enter a valid amount");
export const percent = z.coerce.number().min(0, "Minimum 0%").max(100, "Maximum 100%");
export const requiredText = z.string().trim().min(1, "Required");
export const optionalText = z.string().trim().optional().nullable().transform((value) => value || null);
export const mobile = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value || null)
  .refine((value) => !value || /^[+]?\d[\d\s-]{7,14}$/.test(value), "Enter a valid mobile number");
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

export const siteSchema = z.object({
  name: requiredText,
  client_name: requiredText,
  client_mobile: mobile,
  address: requiredText,
  work_type: requiredText,
  start_date: isoDate,
  expected_completion_date: z.string().optional().nullable(),
  status: z.enum(["active", "paused", "completed"]),
  budget: money,
  notes: optionalText,
  progress_percent: percent
});

export const labourSchema = z.object({
  full_name: requiredText,
  mobile,
  work_type: requiredText,
  default_daily_wage: money,
  site_id: z.string().optional().nullable(),
  advance_payment: money,
  balance_payment: money,
  status: z.enum(["active", "inactive"])
});

export const attendanceSchema = z.object({
  site_id: requiredText,
  labour_id: requiredText,
  date: isoDate,
  status: z.enum(["present", "absent", "half_day"]),
  overtime_hours: money,
  daily_wage: money,
  wage_amount: money,
  notes: optionalText
});

export const materialSchema = z.object({
  site_id: requiredText,
  supplier_id: z.string().optional().nullable(),
  date: isoDate,
  material_name: requiredText,
  quantity: money,
  unit: requiredText,
  rate: money,
  total: money,
  supplier_name: optionalText,
  supplier_mobile: mobile,
  bill_number: optionalText,
  bill_photo_url: optionalText,
  payment_status: z.enum(["paid", "partial", "unpaid"]),
  notes: optionalText
});

export const supplierSchema = z.object({
  name: requiredText,
  mobile,
  material_type: optionalText,
  address: optionalText
});

export const expenseSchema = z.object({
  site_id: z.string().optional().nullable(),
  date: isoDate,
  category: z.enum(["labour", "material", "transport", "equipment", "food", "site", "office", "misc"]),
  amount: money,
  payment_mode: z.enum(["cash", "upi", "bank_transfer", "cheque"]),
  notes: optionalText,
  receipt_photo_url: optionalText
});

export const clientPaymentSchema = z.object({
  site_id: requiredText,
  contract_amount: money,
  received_amount: money,
  pending_amount: money,
  payment_date: isoDate,
  payment_mode: z.enum(["cash", "upi", "bank_transfer", "cheque"]),
  notes: optionalText
});

export const supplierPaymentSchema = z.object({
  supplier_id: requiredText,
  site_id: z.string().optional().nullable(),
  paid_amount: money,
  pending_amount: money,
  payment_date: isoDate,
  payment_mode: z.enum(["cash", "upi", "bank_transfer", "cheque"]),
  bill_reference: optionalText,
  notes: optionalText
});

export const progressSchema = z.object({
  site_id: requiredText,
  date: isoDate,
  title: requiredText,
  description: requiredText,
  progress_percent: percent,
  ai_summary: optionalText
});

export const reminderSchema = z.object({
  site_id: z.string().optional().nullable(),
  title: requiredText,
  description: optionalText,
  due_date: isoDate,
  status: z.enum(["open", "done", "snoozed"]),
  snoozed_until: z.string().optional().nullable()
});

export const memberSchema = z.object({
  user_id: z.string().optional().nullable(),
  full_name: requiredText,
  email: z.string().email("Enter a valid email"),
  phone: mobile,
  role: z.enum(["admin", "staff", "viewer"]),
  status: z.enum(["active", "invited", "disabled"]),
  can_delete_financial: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false)
});

export const loginSchema = z.object({
  email: requiredText,
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const signUpSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: requiredText,
  companyName: requiredText
});

export const aiDraftSchema = z.object({
  intent: z.enum(["attendance", "material", "expense", "client_payment", "supplier_payment", "progress", "labour", "reminder", "unknown"]),
  confidence: z.number().min(0).max(1),
  missing_fields: z.array(z.string()),
  original_text: requiredText,
  draft: z.record(z.string(), z.unknown())
});
