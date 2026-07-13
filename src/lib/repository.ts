"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db, localRecordKey, type PendingMutation } from "./db";
import { createId } from "./id";
import { requireSupabase, supabase } from "./supabase";
import type { AnyEntity, EntityMap, SourceType, TableName } from "@/types/domain";

export const syncableTables: TableName[] = [
  "sites",
  "labour",
  "attendance",
  "labour_payments",
  "suppliers",
  "materials",
  "expenses",
  "client_payments",
  "supplier_payments",
  "partner_draws",
  "daily_closings",
  "approval_requests",
  "progress_updates",
  "extra_works",
  "progress_photos",
  "reminders",
  "notifications",
  "activity_logs",
  "audit_logs",
  "ai_conversations",
  "ai_messages",
  "ai_memories",
  "ai_memory_links",
  "smart_suggestions",
  "user_preferences",
  "data_health_checks"
];

export const AUTO_SYNC_EVENT = "hh-spaces:auto-sync-request";

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function isLocalOnlyMode() {
  return typeof window !== "undefined" && window.localStorage.getItem("sitetracker.offlineMode") === "1";
}

function canUseCloud() {
  return Boolean(supabase && isBrowserOnline() && !isLocalOnlyMode());
}

function requestAutoSync(companyId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTO_SYNC_EVENT, { detail: { companyId } }));
}

function nowIso() {
  return new Date().toISOString();
}

function baseMeta(companyId: string, userId: string | null, source: SourceType, idempotencyKey?: string) {
  const now = nowIso();
  return {
    company_id: companyId,
    created_by: userId,
    updated_by: userId,
    created_at: now,
    updated_at: now,
    source,
    sync_status: isBrowserOnline() ? "synced" : "pending",
    idempotency_key: idempotencyKey || createId("idem"),
    archived: false,
    deleted_at: null
  };
}

function cloudSyncedPayload(payload: Record<string, unknown>) {
  return {
    ...payload,
    sync_status: "synced",
    updated_at: String(payload.updated_at || nowIso())
  };
}

export async function getLocalRecords<T extends TableName>(table: T, companyId: string) {
  const rows = await db.records.where("[table+companyId]").equals([table, companyId]).toArray();
  return rows
    .map((row) => row.record as EntityMap[T])
    .filter((row) => !row.deleted_at)
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}

export async function cacheRecords<T extends TableName>(table: T, companyId: string, records: EntityMap[T][]) {
  await db.transaction("rw", db.records, async () => {
    const existingRows = await db.records.where("[table+companyId]").equals([table, companyId]).toArray();
    const remoteIds = new Set(records.map((record) => record.id));
    const localOnlyRows = existingRows.filter((row) => {
      const record = row.record as AnyEntity;
      return !remoteIds.has(record.id) && ["pending", "failed", "conflict"].includes(record.sync_status);
    });
    await db.records.where("[table+companyId]").equals([table, companyId]).delete();
    await db.records.bulkPut(
      [
        ...records.map((record) => ({
          key: localRecordKey(table, record.id),
          table,
          companyId,
          record,
          updatedAt: record.updated_at || nowIso()
        })),
        ...localOnlyRows
      ]
    );
  });
}

export function mergeCloudRowsWithLocalPending<T extends TableName>(cloudRows: EntityMap[T][], localRows: EntityMap[T][]) {
  const cloudIds = new Set(cloudRows.map((row) => row.id));
  const localPending = localRows.filter((row) => !cloudIds.has(row.id) && ["pending", "failed", "conflict"].includes(row.sync_status));
  return [...cloudRows, ...localPending].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}

export async function fetchRecords<T extends TableName>(table: T, companyId: string) {
  const localRows = await getLocalRecords(table, companyId);

  if (!canUseCloud()) {
    return localRows;
  }

  const { data, error } = await requireSupabase()
    .from(table)
    .select("*")
    .eq("company_id", companyId)
    .eq("archived", false)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "PGRST205" || error.message.toLowerCase().includes("could not find the table")) return localRows;
    if (localRows.length) return localRows;
    throw error;
  }

  const rows = (data || []) as EntityMap[T][];
  await cacheRecords(table, companyId, rows);
  return mergeCloudRowsWithLocalPending(rows, localRows);
}

export async function queueMutation(mutation: PendingMutation) {
  await db.pendingMutations.put(mutation);
  requestAutoSync(mutation.companyId);
}

async function applyLocal<T extends TableName>(table: T, companyId: string, record: EntityMap[T]) {
  await db.records.put({
    key: localRecordKey(table, record.id),
    table,
    companyId,
    record,
    updatedAt: record.updated_at || nowIso()
  });
}

export async function createRecord<T extends TableName>(
  table: T,
  companyId: string,
  values: Partial<EntityMap[T]>,
  options: { userId?: string | null; source?: SourceType } = {}
) {
  const idempotencyKey = String(values.idempotency_key || createId("idem"));
  const record = {
    id: createId(table),
    ...baseMeta(companyId, options.userId || null, options.source || "manual", idempotencyKey),
    ...values,
    idempotency_key: idempotencyKey,
    sync_status: "pending"
  } as EntityMap[T];

  await applyLocal(table, companyId, record);

  let lastError: string | null = null;
  if (canUseCloud()) {
    const cloudRecord = { ...record, sync_status: "synced" } as EntityMap[T];
    const { error } = await requireSupabase().from(table).insert(cloudRecord);
    if (!error) {
      await applyLocal(table, companyId, cloudRecord);
      return cloudRecord;
    }
    lastError = error.message;
  }

  await queueMutation({
    id: createId("mutation"),
    table,
    operationType: "insert",
    companyId,
    recordId: record.id,
    idempotencyKey,
    payload: record as Record<string, unknown>,
    retryCount: 0,
    lastError,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  return record;
}

export async function updateRecord<T extends TableName>(
  table: T,
  companyId: string,
  recordId: string,
  values: Partial<EntityMap[T]>,
  options: { userId?: string | null; source?: SourceType } = {}
) {
  const idempotencyKey = String(values.idempotency_key || (existingIdempotency(table, recordId) ?? createId("idem")));
  const existing = await db.records.get(localRecordKey(table, recordId));
  const record = {
    ...(existing?.record || {}),
    ...values,
    id: recordId,
    company_id: companyId,
    updated_by: options.userId || (existing?.record as AnyEntity | undefined)?.updated_by || null,
    updated_at: nowIso(),
    source: options.source || (existing?.record as AnyEntity | undefined)?.source || "manual",
    sync_status: "pending",
    idempotency_key: idempotencyKey
  } as EntityMap[T];

  await applyLocal(table, companyId, record);

  let lastError: string | null = null;
  if (canUseCloud()) {
    const cloudValues = cloudSyncedPayload({
      ...(values as Record<string, unknown>),
      updated_at: record.updated_at,
      updated_by: record.updated_by,
      source: record.source
    });
    const { error } = await requireSupabase()
      .from(table)
      .update(cloudValues)
      .eq("id", recordId)
      .eq("company_id", companyId);
    if (!error) {
      const syncedRecord = { ...record, sync_status: "synced" } as EntityMap[T];
      await applyLocal(table, companyId, syncedRecord);
      return syncedRecord;
    }
    lastError = error.message;
  }

  await queueMutation({
    id: createId("mutation"),
    table,
    operationType: "update",
    companyId,
    recordId,
    idempotencyKey,
    payload: cloudSyncedPayload({
      ...(values as Record<string, unknown>),
      updated_at: record.updated_at,
      updated_by: record.updated_by,
      source: record.source
    }),
    retryCount: 0,
    lastError,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  return record;
}

function existingIdempotency(_table: TableName, _recordId: string) {
  return null;
}

export async function deleteRecord<T extends TableName>(table: T, companyId: string, recordId: string, userId?: string | null) {
  const deletedAt = nowIso();
  const deletePayload = {
    archived: true,
    deleted_at: deletedAt,
    updated_at: deletedAt,
    updated_by: userId || null,
    sync_status: "synced"
  };
  const existing = await db.records.get(localRecordKey(table, recordId));
  if (existing) {
    await applyLocal(table, companyId, {
      ...(existing.record as AnyEntity),
      ...deletePayload,
      updated_by: userId || (existing.record as AnyEntity).updated_by
    } as EntityMap[T]);
  }

  let lastError: string | null = null;
  if (canUseCloud()) {
    const { error } = await requireSupabase()
      .from(table)
      .update(deletePayload)
      .eq("id", recordId)
      .eq("company_id", companyId);
    if (!error) return;
    lastError = error.message;
  }

  await queueMutation({
    id: createId("mutation"),
    table,
    operationType: "delete",
    companyId,
    recordId,
    idempotencyKey: createId("idem"),
    payload: deletePayload,
    retryCount: 0,
    lastError,
    createdAt: deletedAt,
    updatedAt: deletedAt
  });
}

export async function syncPendingMutations(companyId: string) {
  if (!canUseCloud()) return { synced: 0 };
  const pending = await db.pendingMutations.where({ companyId }).sortBy("createdAt");
  let synced = 0;

  for (const item of pending) {
    const client = requireSupabase().from(item.table);
    const payload = cloudSyncedPayload(item.payload);
    const response =
      item.operationType === "insert"
        ? await client.upsert(payload, { onConflict: "idempotency_key" })
        : item.operationType === "update"
          ? await client.update(payload).eq("id", item.recordId).eq("company_id", companyId)
          : await client.update(payload).eq("id", item.recordId).eq("company_id", companyId);

    if (response.error) {
      await db.pendingMutations.update(item.id, {
        retryCount: item.retryCount + 1,
        lastError: response.error.message,
        updatedAt: nowIso()
      });
      break;
    }
    if (item.operationType !== "delete") {
      const local = await db.records.get(localRecordKey(item.table, item.recordId));
      if (local) {
        await applyLocal(item.table, companyId, {
          ...(local.record as AnyEntity),
          sync_status: "synced",
          updated_at: (local.record as AnyEntity).updated_at || nowIso()
        } as EntityMap[typeof item.table]);
      }
    }
    await db.pendingMutations.delete(item.id);
    synced += 1;
  }

  return { synced };
}

export async function migrateLocalCompanyRecords(fromCompanyId: string, toCompanyId: string, userId: string | null) {
  if (fromCompanyId === toCompanyId) return 0;
  const rows = await db.records.where("companyId").equals(fromCompanyId).toArray();
  let migrated = 0;

  for (const row of rows) {
    if (!syncableTables.includes(row.table)) continue;
    const record = {
      ...(row.record as AnyEntity),
      company_id: toCompanyId,
      updated_by: userId,
      sync_status: "pending"
    } as EntityMap[typeof row.table];

    await applyLocal(row.table, toCompanyId, record);
    const exists = await db.pendingMutations.where({ companyId: toCompanyId, recordId: record.id }).count();
    if (!exists) {
      await queueMutation({
        id: createId("mutation"),
        table: row.table,
        operationType: "insert",
        companyId: toCompanyId,
        recordId: record.id,
        idempotencyKey: record.idempotency_key,
        payload: record as Record<string, unknown>,
        retryCount: 0,
        lastError: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    }
    migrated += 1;
  }

  return migrated;
}

export function useRecords<T extends TableName>(table: T, companyId?: string) {
  return useQuery({
    queryKey: ["records", table, companyId],
    queryFn: () => fetchRecords(table, companyId || ""),
    enabled: Boolean(companyId),
    staleTime: 30_000,
    gcTime: 10 * 60_000
  });
}

export function useCreateRecord<T extends TableName>(table: T, companyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<EntityMap[T]> | { values: Partial<EntityMap[T]>; userId?: string | null; source?: SourceType }) => {
      if ("values" in input) return createRecord(table, companyId || "", input.values, { userId: input.userId, source: input.source });
      return createRecord(table, companyId || "", input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["records", table, companyId] })
  });
}

export function useUpdateRecord<T extends TableName>(table: T, companyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values, userId, source }: { id: string; values: Partial<EntityMap[T]>; userId?: string | null; source?: SourceType }) =>
      updateRecord(table, companyId || "", id, values, { userId, source }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["records", table, companyId] })
  });
}

export function useDeleteRecord<T extends TableName>(table: T, companyId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { id: string; userId?: string | null }) =>
      typeof input === "string" ? deleteRecord(table, companyId || "", input) : deleteRecord(table, companyId || "", input.id, input.userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["records", table, companyId] })
  });
}
