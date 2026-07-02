"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db, localRecordKey, type PendingMutation } from "./db";
import { createId } from "./id";
import { requireSupabase, supabase } from "./supabase";
import type { AnyEntity, EntityMap, SourceType, TableName } from "@/types/domain";

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
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

export async function getLocalRecords<T extends TableName>(table: T, companyId: string) {
  const rows = await db.records.where({ table, companyId }).toArray();
  return rows
    .map((row) => row.record as EntityMap[T])
    .filter((row) => !row.deleted_at)
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}

export async function cacheRecords<T extends TableName>(table: T, companyId: string, records: EntityMap[T][]) {
  await db.transaction("rw", db.records, async () => {
    await db.records.where({ table, companyId }).delete();
    await db.records.bulkPut(
      records.map((record) => ({
        key: localRecordKey(table, record.id),
        table,
        companyId,
        record,
        updatedAt: record.updated_at || nowIso()
      }))
    );
  });
}

export async function fetchRecords<T extends TableName>(table: T, companyId: string) {
  const localRows = await getLocalRecords(table, companyId);

  if (!supabase || !isBrowserOnline()) {
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
    if (localRows.length) return localRows;
    throw error;
  }

  const rows = (data || []) as EntityMap[T][];
  await cacheRecords(table, companyId, rows);
  return rows;
}

export async function queueMutation(mutation: PendingMutation) {
  await db.pendingMutations.put(mutation);
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
    sync_status: isBrowserOnline() ? "synced" : "pending"
  } as EntityMap[T];

  await applyLocal(table, companyId, record);

  if (supabase && isBrowserOnline()) {
    const { error } = await requireSupabase().from(table).insert(record);
    if (!error) return record;
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
    lastError: null,
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
    sync_status: isBrowserOnline() ? "synced" : "pending",
    idempotency_key: idempotencyKey
  } as EntityMap[T];

  await applyLocal(table, companyId, record);

  if (supabase && isBrowserOnline()) {
    const { error } = await requireSupabase()
      .from(table)
      .update(values as Record<string, unknown>)
      .eq("id", recordId)
      .eq("company_id", companyId);
    if (!error) return record;
  }

  await queueMutation({
    id: createId("mutation"),
    table,
    operationType: "update",
    companyId,
    recordId,
    idempotencyKey,
    payload: { ...values, updated_at: record.updated_at },
    retryCount: 0,
    lastError: null,
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
  const existing = await db.records.get(localRecordKey(table, recordId));
  if (existing) {
    await applyLocal(table, companyId, {
      ...(existing.record as AnyEntity),
      archived: true,
      deleted_at: deletedAt,
      updated_at: deletedAt,
      updated_by: userId || (existing.record as AnyEntity).updated_by
    } as EntityMap[T]);
  }

  if (supabase && isBrowserOnline()) {
    const { error } = await requireSupabase()
      .from(table)
      .update({ archived: true, deleted_at: deletedAt, updated_at: deletedAt, updated_by: userId || null })
      .eq("id", recordId)
      .eq("company_id", companyId);
    if (!error) return;
  }

  await queueMutation({
    id: createId("mutation"),
    table,
    operationType: "delete",
    companyId,
    recordId,
    idempotencyKey: createId("idem"),
    payload: { archived: true, deleted_at: deletedAt, updated_at: deletedAt, updated_by: userId || null },
    retryCount: 0,
    lastError: null,
    createdAt: deletedAt,
    updatedAt: deletedAt
  });
}

export async function syncPendingMutations(companyId: string) {
  if (!supabase || !isBrowserOnline()) return { synced: 0 };
  const pending = await db.pendingMutations.where({ companyId }).sortBy("createdAt");
  let synced = 0;

  for (const item of pending) {
    const client = requireSupabase().from(item.table);
    const response =
      item.operationType === "insert"
        ? await client.upsert(item.payload, { onConflict: "idempotency_key" })
        : item.operationType === "update"
          ? await client.update(item.payload).eq("id", item.recordId).eq("company_id", companyId)
          : await client.update(item.payload).eq("id", item.recordId).eq("company_id", companyId);

    if (response.error) {
      await db.pendingMutations.update(item.id, {
        retryCount: item.retryCount + 1,
        lastError: response.error.message,
        updatedAt: nowIso()
      });
      break;
    }
    await db.pendingMutations.delete(item.id);
    synced += 1;
  }

  return { synced };
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
