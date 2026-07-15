"use client";

import Dexie, { type Table } from "dexie";
import type { AnyEntity, TableName } from "@/types/domain";

export type LocalRecord = {
  key: string;
  table: TableName;
  companyId: string;
  record: AnyEntity;
  updatedAt: string;
};

export type PendingMutation = {
  id: string;
  table: TableName;
  operationType: "insert" | "update" | "delete" | "upload";
  companyId: string;
  recordId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppMeta = {
  key: string;
  value: unknown;
};

class HHSpacesDb extends Dexie {
  records!: Table<LocalRecord, string>;
  pendingMutations!: Table<PendingMutation, string>;
  meta!: Table<AppMeta, string>;

  constructor() {
    super("site-tracker-pro");
    this.version(1).stores({
      records: "key, table, companyId, updatedAt",
      pendingMutations: "id, table, companyId, recordId, createdAt",
      meta: "key"
    });
    this.version(2).stores({
      records: "key, table, companyId, updatedAt",
      pendingMutations: "id, table, companyId, recordId, idempotencyKey, createdAt, updatedAt",
      meta: "key"
    });
    this.version(3).stores({
      records: "key, table, companyId, [table+companyId], updatedAt",
      pendingMutations: "id, table, companyId, recordId, idempotencyKey, [companyId+createdAt], createdAt, updatedAt",
      meta: "key"
    });
    this.version(4).stores({
      records: "key, table, companyId, [table+companyId], updatedAt",
      pendingMutations: "id, table, companyId, recordId, idempotencyKey, [companyId+recordId], [companyId+createdAt], createdAt, updatedAt",
      meta: "key"
    });
  }
}

export const db = new HHSpacesDb();

export function localRecordKey(table: TableName, id: string) {
  return `${table}:${id}`;
}

export function lastSyncMetaKey(companyId: string) {
  return `last-sync:${companyId}`;
}
