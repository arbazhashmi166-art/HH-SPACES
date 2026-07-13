export type Role = "admin" | "staff" | "viewer";
export type SourceType = "manual" | "ai" | "voice" | "offline_sync" | "import";
export type SyncStatus = "synced" | "pending" | "failed" | "conflict";
export type SiteStatus = "active" | "paused" | "completed";
export type AttendanceStatus = "present" | "absent" | "half_day";
export type PaymentMode = "cash" | "upi" | "bank_transfer" | "cheque";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type ReminderStatus = "open" | "done" | "snoozed";
export type MoneyCategory = "labour" | "material" | "transport" | "equipment" | "food" | "site" | "office" | "misc";
export type ExtraWorkStatus = "draft" | "approved" | "rejected" | "billed" | "paid";
export type PartnerDrawCategory = "owner_draw" | "profit_share" | "emergency" | "advance" | "salary" | "reimbursement" | "other";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalCategory = "partner_draw" | "extra_work" | "supplier_payment" | "client_payment" | "expense" | "other";

export type TableName =
  | "sites"
  | "labour"
  | "attendance"
  | "labour_payments"
  | "suppliers"
  | "materials"
  | "expenses"
  | "client_payments"
  | "supplier_payments"
  | "partner_draws"
  | "daily_closings"
  | "approval_requests"
  | "progress_updates"
  | "extra_works"
  | "progress_photos"
  | "reminders"
  | "notifications"
  | "company_members"
  | "activity_logs"
  | "audit_logs"
  | "offline_sync_queue"
  | "ai_conversations"
  | "ai_messages"
  | "ai_memories"
  | "ai_memory_links"
  | "smart_suggestions"
  | "user_preferences"
  | "data_health_checks";

export type BaseRecord = {
  id: string;
  company_id: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  source: SourceType;
  sync_status: SyncStatus;
  idempotency_key: string;
  archived: boolean;
  deleted_at: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  gst_number: string | null;
  pan_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  bank_details: string | null;
  upi_id: string | null;
  logo_url: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CompanyMember = BaseRecord & {
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: "active" | "invited" | "disabled";
  can_delete_financial: boolean;
};

export type Site = BaseRecord & {
  name: string;
  client_name: string;
  client_mobile: string | null;
  address: string;
  work_type: string;
  start_date: string;
  expected_completion_date: string | null;
  status: SiteStatus;
  budget: number;
  notes: string | null;
  progress_percent: number;
};

export type Labour = BaseRecord & {
  full_name: string;
  mobile: string | null;
  work_type: string;
  default_daily_wage: number;
  site_id: string | null;
  advance_payment: number;
  balance_payment: number;
  status: "active" | "inactive";
};

export type Attendance = BaseRecord & {
  site_id: string;
  labour_id: string;
  date: string;
  status: AttendanceStatus;
  overtime_hours: number;
  daily_wage: number;
  wage_amount: number;
  notes: string | null;
};

export type LabourPayment = BaseRecord & {
  labour_id: string;
  site_id: string | null;
  date: string;
  amount: number;
  mode: PaymentMode;
  notes: string | null;
};

export type Supplier = BaseRecord & {
  name: string;
  mobile: string | null;
  material_type: string | null;
  address: string | null;
};

export type Material = BaseRecord & {
  site_id: string;
  supplier_id: string | null;
  date: string;
  material_name: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  supplier_name: string | null;
  supplier_mobile: string | null;
  bill_number: string | null;
  bill_photo_url: string | null;
  payment_status: PaymentStatus;
  notes: string | null;
};

export type Expense = BaseRecord & {
  site_id: string | null;
  date: string;
  category: MoneyCategory;
  amount: number;
  payment_mode: PaymentMode;
  notes: string | null;
  receipt_photo_url: string | null;
};

export type ClientPayment = BaseRecord & {
  site_id: string;
  contract_amount: number;
  received_amount: number;
  pending_amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  notes: string | null;
};

export type SupplierPayment = BaseRecord & {
  supplier_id: string;
  site_id: string | null;
  paid_amount: number;
  pending_amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  bill_reference: string | null;
  notes: string | null;
};

export type PartnerDraw = BaseRecord & {
  partner_name: string;
  date: string;
  category: PartnerDrawCategory;
  amount: number;
  payment_mode: PaymentMode;
  site_id: string | null;
  approved_by: string | null;
  notes: string | null;
};

export type DailyClosing = BaseRecord & {
  site_id: string | null;
  date: string;
  attendance_done: boolean;
  material_done: boolean;
  expense_done: boolean;
  progress_done: boolean;
  client_followup_done: boolean;
  report_text: string;
  notes: string | null;
};

export type ApprovalRequest = BaseRecord & {
  site_id: string | null;
  category: ApprovalCategory;
  title: string;
  amount: number;
  requested_by_name: string | null;
  approver_name: string | null;
  status: ApprovalStatus;
  linked_table: TableName | null;
  linked_record_id: string | null;
  decision_notes: string | null;
  decided_at: string | null;
};

export type ProgressUpdate = BaseRecord & {
  site_id: string;
  date: string;
  title: string;
  description: string;
  progress_percent: number;
  ai_summary: string | null;
};

export type ExtraWork = BaseRecord & {
  site_id: string;
  date: string;
  work_type: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  client_approved: boolean;
  status: ExtraWorkStatus;
  notes: string | null;
};

export type ProgressPhoto = BaseRecord & {
  site_id: string;
  progress_update_id: string | null;
  photo_url: string;
  storage_path: string;
  caption: string | null;
  photo_type: "before" | "during" | "after";
  taken_at: string;
};

export type Reminder = BaseRecord & {
  site_id: string | null;
  title: string;
  description: string | null;
  due_date: string;
  status: ReminderStatus;
  snoozed_until: string | null;
};

export type Notification = BaseRecord & {
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  read_at: string | null;
};

export type ActivityLog = BaseRecord & {
  site_id: string | null;
  entity_table: TableName;
  entity_id: string;
  action: "create" | "update" | "delete" | "archive" | "sync" | "ai_confirm";
  description: string;
};

export type AuditLog = BaseRecord & {
  entity_table: TableName;
  entity_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
};

export type OfflineSyncQueue = BaseRecord & {
  operation_type: "insert" | "update" | "delete" | "upload";
  table_name: TableName;
  record_id: string;
  payload: Record<string, unknown>;
  retry_count: number;
  last_error: string | null;
  synced_at: string | null;
};

export type AiConversation = BaseRecord & {
  title: string;
};

export type AiMessage = BaseRecord & {
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  structured_json: Record<string, unknown> | null;
  confidence: number | null;
  confirmed_at: string | null;
};

export type AiMemory = BaseRecord & {
  site_id: string | null;
  memory_type:
    | "business"
    | "site"
    | "labour"
    | "supplier"
    | "client"
    | "payment"
    | "material"
    | "expense"
    | "conversation"
    | "activity"
    | "reminder"
    | "preference";
  title: string;
  content: string;
  source_record_table: TableName | null;
  source_record_id: string | null;
  embedding: number[] | null;
  importance: number;
};

export type AiMemoryLink = BaseRecord & {
  memory_id: string;
  entity_table: TableName;
  entity_id: string;
};

export type SmartSuggestion = BaseRecord & {
  site_id: string | null;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "dismissed" | "done";
};

export type UserPreference = BaseRecord & {
  user_id: string;
  key: string;
  value: Record<string, unknown>;
};

export type DataHealthCheck = BaseRecord & {
  site_id: string | null;
  check_type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  entity_table: TableName | null;
  entity_id: string | null;
  resolved_at: string | null;
};

export type EntityMap = {
  sites: Site;
  labour: Labour;
  attendance: Attendance;
  labour_payments: LabourPayment;
  suppliers: Supplier;
  materials: Material;
  expenses: Expense;
  client_payments: ClientPayment;
  supplier_payments: SupplierPayment;
  partner_draws: PartnerDraw;
  daily_closings: DailyClosing;
  approval_requests: ApprovalRequest;
  progress_updates: ProgressUpdate;
  extra_works: ExtraWork;
  progress_photos: ProgressPhoto;
  reminders: Reminder;
  notifications: Notification;
  company_members: CompanyMember;
  activity_logs: ActivityLog;
  audit_logs: AuditLog;
  offline_sync_queue: OfflineSyncQueue;
  ai_conversations: AiConversation;
  ai_messages: AiMessage;
  ai_memories: AiMemory;
  ai_memory_links: AiMemoryLink;
  smart_suggestions: SmartSuggestion;
  user_preferences: UserPreference;
  data_health_checks: DataHealthCheck;
};

export type AnyEntity = EntityMap[keyof EntityMap];

export type DashboardMetrics = {
  activeSites: number;
  todayLabourCost: number;
  todayMaterialCost: number;
  todayExpenses: number;
  pendingClientPayments: number;
  pendingSupplierPayments: number;
  labourAdvanceBalance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  estimatedProfit: number;
  approvedExtraWorks: number;
  unbilledExtraWorks: number;
  partnerDrawsTotal: number;
};
