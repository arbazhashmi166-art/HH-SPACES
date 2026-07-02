import type { Role, TableName } from "@/types/domain";

const financialTables: TableName[] = ["materials", "expenses", "client_payments", "supplier_payments", "labour_payments"];

export function canCreate(role: Role) {
  return role === "admin" || role === "staff";
}

export function canUpdate(role: Role) {
  return role === "admin" || role === "staff";
}

export function canArchive(role: Role, table: TableName, canDeleteFinancial = false) {
  if (role === "admin") return true;
  if (role !== "staff") return false;
  if (financialTables.includes(table)) return canDeleteFinancial;
  return true;
}

export function roleLabel(role: Role) {
  return role === "admin" ? "Admin" : role === "staff" ? "Staff" : "Viewer";
}
