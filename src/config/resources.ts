import type { ZodTypeAny } from "zod";
import {
  attendanceSchema,
  clientPaymentSchema,
  expenseSchema,
  labourSchema,
  materialSchema,
  memberSchema,
  progressSchema,
  reminderSchema,
  siteSchema,
  supplierPaymentSchema,
  supplierSchema
} from "@/lib/schemas";
import type { AnyEntity, TableName } from "@/types/domain";
import { todayIso } from "@/utils/format";

export type FieldOption = { label: string; value: string };
export type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "email" | "tel" | "file";
  required?: boolean;
  options?: FieldOption[];
  rows?: number;
  helper?: string;
};

export type LookupContext = {
  sites: Array<{ id: string; name: string; client_name?: string }>;
  labour: Array<{ id: string; full_name: string; work_type?: string }>;
  suppliers: Array<{ id: string; name: string }>;
};

type ResourceRow = Record<string, any>;

export type ResourceConfig = {
  table: TableName;
  path: string;
  title: string;
  subtitle: string;
  addLabel: string;
  schema: ZodTypeAny;
  fields: FieldConfig[];
  cardTitle: (row: ResourceRow, lookups: LookupContext) => string;
  cardSubtitle: (row: ResourceRow, lookups: LookupContext) => string;
  amount?: (row: ResourceRow) => number;
  searchText: (row: ResourceRow, lookups: LookupContext) => string;
  defaults: () => Partial<AnyEntity>;
};

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Completed", value: "completed" }
];

const paymentModes = [
  { label: "Cash", value: "cash" },
  { label: "UPI", value: "upi" },
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Cheque", value: "cheque" }
];

const siteField: FieldConfig = { name: "site_id", label: "Site", type: "select", required: true, options: [] };

export const resources = {
  sites: {
    table: "sites",
    path: "/sites",
    title: "Sites",
    subtitle: "Contracts, budgets, progress, timelines, and site financial health.",
    addLabel: "Add Site",
    schema: siteSchema,
    fields: [
      { name: "name", label: "Site Name", type: "text", required: true },
      { name: "client_name", label: "Client Name", type: "text", required: true },
      { name: "client_mobile", label: "Client Mobile", type: "tel" },
      { name: "address", label: "Site Address", type: "textarea", rows: 3, required: true },
      { name: "work_type", label: "Work Type", type: "text", required: true },
      { name: "start_date", label: "Start Date", type: "date", required: true },
      { name: "expected_completion_date", label: "Expected Completion", type: "date" },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
      { name: "budget", label: "Budget", type: "number", required: true },
      { name: "progress_percent", label: "Progress %", type: "number" },
      { name: "notes", label: "Notes", type: "textarea", rows: 3 }
    ],
    cardTitle: (row) => row.name,
    cardSubtitle: (row) => `${row.client_name} • ${row.work_type} • ${row.progress_percent}%`,
    amount: (row) => row.budget,
    searchText: (row) => `${row.name} ${row.client_name} ${row.client_mobile || ""} ${row.address} ${row.work_type}`,
    defaults: () => ({ start_date: todayIso(), expected_completion_date: todayIso(), status: "active", budget: 0, progress_percent: 0 })
  },
  labour: {
    table: "labour",
    path: "/labour",
    title: "Labour",
    subtitle: "Labour profiles, wages, advances, balances, and assigned sites.",
    addLabel: "Add Labour",
    schema: labourSchema,
    fields: [
      { name: "full_name", label: "Labour Name", type: "text", required: true },
      { name: "mobile", label: "Mobile Number", type: "tel" },
      { name: "work_type", label: "Work Type", type: "text", required: true },
      { name: "default_daily_wage", label: "Default Daily Wage", type: "number", required: true },
      { ...siteField, required: false },
      { name: "advance_payment", label: "Advance Payment", type: "number" },
      { name: "balance_payment", label: "Balance Payment", type: "number" },
      { name: "status", label: "Status", type: "select", options: [{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }] }
    ],
    cardTitle: (row) => row.full_name,
    cardSubtitle: (row, lookups) => `${row.work_type} • ${lookups.sites.find((site) => site.id === row.site_id)?.name || "No site"} • Balance ₹${row.balance_payment}`,
    amount: (row) => row.default_daily_wage,
    searchText: (row) => `${row.full_name} ${row.mobile || ""} ${row.work_type}`,
    defaults: () => ({ default_daily_wage: 0, advance_payment: 0, balance_payment: 0, status: "active" })
  },
  attendance: {
    table: "attendance",
    path: "/attendance",
    title: "Attendance",
    subtitle: "Present, absent, half day, overtime, auto wage, and duplicate prevention.",
    addLabel: "Mark Attendance",
    schema: attendanceSchema,
    fields: [
      siteField,
      { name: "labour_id", label: "Labour", type: "select", required: true, options: [] },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "status", label: "Status", type: "select", options: [{ label: "Present", value: "present" }, { label: "Absent", value: "absent" }, { label: "Half Day", value: "half_day" }] },
      { name: "daily_wage", label: "Daily Wage", type: "number" },
      { name: "overtime_hours", label: "Overtime Hours", type: "number" },
      { name: "wage_amount", label: "Wage Amount", type: "number" },
      { name: "notes", label: "Notes", type: "textarea", rows: 3 }
    ],
    cardTitle: (row, lookups) => lookups.labour.find((item) => item.id === row.labour_id)?.full_name || "Labour",
    cardSubtitle: (row, lookups) => `${row.date} • ${lookups.sites.find((site) => site.id === row.site_id)?.name || "Site"} • ${row.status}`,
    amount: (row) => row.wage_amount,
    searchText: (row) => `${row.date} ${row.status} ${row.notes || ""}`,
    defaults: () => ({ date: todayIso(), status: "present", daily_wage: 0, overtime_hours: 0, wage_amount: 0 })
  },
  materials: {
    table: "materials",
    path: "/materials",
    title: "Materials",
    subtitle: "Purchases, suppliers, bill photos, payment status, and material rate history.",
    addLabel: "Add Material",
    schema: materialSchema,
    fields: [
      siteField,
      { name: "supplier_id", label: "Supplier", type: "select", options: [] },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "material_name", label: "Material Name", type: "text", required: true },
      { name: "quantity", label: "Quantity", type: "number", required: true },
      { name: "unit", label: "Unit", type: "text", required: true },
      { name: "rate", label: "Rate", type: "number", required: true },
      { name: "total", label: "Total", type: "number", required: true },
      { name: "supplier_name", label: "Supplier Name", type: "text" },
      { name: "supplier_mobile", label: "Supplier Mobile", type: "tel" },
      { name: "bill_number", label: "Bill Number", type: "text" },
      { name: "bill_photo_url", label: "Bill Photo URL", type: "text" },
      { name: "payment_status", label: "Payment Status", type: "select", options: [{ label: "Paid", value: "paid" }, { label: "Partial", value: "partial" }, { label: "Unpaid", value: "unpaid" }] },
      { name: "notes", label: "Notes", type: "textarea", rows: 3 }
    ],
    cardTitle: (row) => row.material_name,
    cardSubtitle: (row, lookups) => `${row.quantity} ${row.unit} • ${lookups.sites.find((site) => site.id === row.site_id)?.name || "Site"} • ${row.payment_status}`,
    amount: (row) => row.total,
    searchText: (row) => `${row.material_name} ${row.supplier_name || ""} ${row.bill_number || ""}`,
    defaults: () => ({ date: todayIso(), quantity: 0, unit: "Nos", rate: 0, total: 0, payment_status: "unpaid" })
  },
  suppliers: {
    table: "suppliers",
    path: "/suppliers",
    title: "Suppliers",
    subtitle: "Supplier contacts, material types, payment exposure, and rate history.",
    addLabel: "Add Supplier",
    schema: supplierSchema,
    fields: [
      { name: "name", label: "Supplier Name", type: "text", required: true },
      { name: "mobile", label: "Mobile Number", type: "tel" },
      { name: "material_type", label: "Material Type", type: "text" },
      { name: "address", label: "Address", type: "textarea", rows: 3 }
    ],
    cardTitle: (row) => row.name,
    cardSubtitle: (row) => `${row.material_type || "General"} • ${row.mobile || "No mobile"}`,
    searchText: (row) => `${row.name} ${row.mobile || ""} ${row.material_type || ""}`,
    defaults: () => ({})
  },
  expenses: {
    table: "expenses",
    path: "/expenses",
    title: "Expenses",
    subtitle: "Daily expenses with receipts, category analysis, and anomaly warnings.",
    addLabel: "Add Expense",
    schema: expenseSchema,
    fields: [
      { ...siteField, required: false },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "category", label: "Category", type: "select", options: ["labour", "material", "transport", "equipment", "food", "site", "office", "misc"].map((value) => ({ label: value, value })) },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "payment_mode", label: "Payment Mode", type: "select", options: paymentModes },
      { name: "notes", label: "Notes", type: "textarea", rows: 3 },
      { name: "receipt_photo_url", label: "Receipt Photo URL", type: "text" }
    ],
    cardTitle: (row) => row.category,
    cardSubtitle: (row) => `${row.date} • ${row.payment_mode} • ${row.notes || "No notes"}`,
    amount: (row) => row.amount,
    searchText: (row) => `${row.category} ${row.notes || ""}`,
    defaults: () => ({ date: todayIso(), category: "misc", amount: 0, payment_mode: "cash" })
  },
  client_payments: {
    table: "client_payments",
    path: "/payments",
    title: "Client Payments",
    subtitle: "Received, pending, follow-up reminders, and site-wise payment history.",
    addLabel: "Add Client Payment",
    schema: clientPaymentSchema,
    fields: [
      siteField,
      { name: "contract_amount", label: "Contract Amount", type: "number" },
      { name: "received_amount", label: "Received Amount", type: "number" },
      { name: "pending_amount", label: "Pending Amount", type: "number" },
      { name: "payment_date", label: "Payment Date", type: "date" },
      { name: "payment_mode", label: "Payment Mode", type: "select", options: paymentModes },
      { name: "notes", label: "Notes", type: "textarea", rows: 3 }
    ],
    cardTitle: (row, lookups) => lookups.sites.find((site) => site.id === row.site_id)?.client_name || "Client Payment",
    cardSubtitle: (row, lookups) => `${lookups.sites.find((site) => site.id === row.site_id)?.name || "Site"} • Pending ₹${row.pending_amount}`,
    amount: (row) => row.received_amount,
    searchText: (row) => `${row.notes || ""} ${row.payment_mode}`,
    defaults: () => ({ payment_date: todayIso(), contract_amount: 0, received_amount: 0, pending_amount: 0, payment_mode: "upi" })
  },
  supplier_payments: {
    table: "supplier_payments",
    path: "/supplier-payments",
    title: "Supplier Payments",
    subtitle: "Supplier bill payments, pending amounts, and bill references.",
    addLabel: "Add Supplier Payment",
    schema: supplierPaymentSchema,
    fields: [
      { name: "supplier_id", label: "Supplier", type: "select", required: true, options: [] },
      { ...siteField, required: false },
      { name: "paid_amount", label: "Paid Amount", type: "number" },
      { name: "pending_amount", label: "Pending Amount", type: "number" },
      { name: "payment_date", label: "Payment Date", type: "date" },
      { name: "payment_mode", label: "Payment Mode", type: "select", options: paymentModes },
      { name: "bill_reference", label: "Bill Reference", type: "text" },
      { name: "notes", label: "Notes", type: "textarea", rows: 3 }
    ],
    cardTitle: (row, lookups) => lookups.suppliers.find((supplier) => supplier.id === row.supplier_id)?.name || "Supplier Payment",
    cardSubtitle: (row) => `${row.payment_date} • Pending ₹${row.pending_amount} • ${row.payment_mode}`,
    amount: (row) => row.paid_amount,
    searchText: (row) => `${row.bill_reference || ""} ${row.notes || ""}`,
    defaults: () => ({ payment_date: todayIso(), paid_amount: 0, pending_amount: 0, payment_mode: "upi" })
  },
  progress_updates: {
    table: "progress_updates",
    path: "/progress",
    title: "Site Progress",
    subtitle: "Daily progress, photos, timeline, delay alerts, and AI summaries.",
    addLabel: "Add Progress",
    schema: progressSchema,
    fields: [
      siteField,
      { name: "date", label: "Date", type: "date", required: true },
      { name: "title", label: "Progress Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", rows: 3, required: true },
      { name: "progress_percent", label: "Progress %", type: "number" },
      { name: "ai_summary", label: "AI Summary", type: "textarea", rows: 2 }
    ],
    cardTitle: (row) => row.title,
    cardSubtitle: (row, lookups) => `${row.date} • ${lookups.sites.find((site) => site.id === row.site_id)?.name || "Site"} • ${row.progress_percent}%`,
    amount: (row) => row.progress_percent,
    searchText: (row) => `${row.title} ${row.description} ${row.ai_summary || ""}`,
    defaults: () => ({ date: todayIso(), progress_percent: 0 })
  },
  reminders: {
    table: "reminders",
    path: "/reminders",
    title: "Reminders",
    subtitle: "Payment follow-ups, attendance missing, site progress, and custom reminders.",
    addLabel: "Add Reminder",
    schema: reminderSchema,
    fields: [
      { ...siteField, required: false },
      { name: "title", label: "Reminder Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", rows: 3 },
      { name: "due_date", label: "Due Date", type: "date" },
      { name: "status", label: "Status", type: "select", options: [{ label: "Open", value: "open" }, { label: "Done", value: "done" }, { label: "Snoozed", value: "snoozed" }] },
      { name: "snoozed_until", label: "Snoozed Until", type: "date" }
    ],
    cardTitle: (row) => row.title,
    cardSubtitle: (row) => `${row.due_date} • ${row.status}`,
    searchText: (row) => `${row.title} ${row.description || ""}`,
    defaults: () => ({ due_date: todayIso(), status: "open" })
  },
  company_members: {
    table: "company_members",
    path: "/staff",
    title: "Staff Management",
    subtitle: "Admin, staff, viewer roles, permissions, and company data protection.",
    addLabel: "Add Staff",
    schema: memberSchema,
    fields: [
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", type: "tel" },
      { name: "role", label: "Role", type: "select", options: [{ label: "Admin", value: "admin" }, { label: "Staff", value: "staff" }, { label: "Viewer", value: "viewer" }] },
      { name: "status", label: "Status", type: "select", options: [{ label: "Active", value: "active" }, { label: "Invited", value: "invited" }, { label: "Disabled", value: "disabled" }] },
      { name: "can_delete_financial", label: "Can Delete Financial Records", type: "select", options: [{ label: "No", value: "false" }, { label: "Yes", value: "true" }] }
    ],
    cardTitle: (row) => row.full_name,
    cardSubtitle: (row) => `${row.email} • ${row.role} • ${row.status}`,
    searchText: (row) => `${row.full_name} ${row.email} ${row.role}`,
    defaults: () => ({ role: "staff", status: "invited", can_delete_financial: false })
  }
} satisfies Partial<Record<TableName, ResourceConfig>>;

export const resourceList = Object.values(resources);

export function buildLookupFields(fields: FieldConfig[], lookups: LookupContext) {
  return fields.map((field) => {
    if (field.name === "site_id") {
      return { ...field, options: lookups.sites.map((site) => ({ label: `${site.name} • ${site.client_name || ""}`, value: site.id })) };
    }
    if (field.name === "labour_id") {
      return { ...field, options: lookups.labour.map((item) => ({ label: `${item.full_name} • ${item.work_type || ""}`, value: item.id })) };
    }
    if (field.name === "supplier_id") {
      return { ...field, options: lookups.suppliers.map((item) => ({ label: item.name, value: item.id })) };
    }
    return field;
  });
}
