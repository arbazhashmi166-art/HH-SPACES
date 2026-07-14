import { describe, expect, it } from "vitest";
import { mergeCloudRowsWithLocalPending, queuedInsertPayloadsAsRecords } from "@/lib/repository";
import type { PendingMutation } from "@/lib/db";
import type { Site } from "@/types/domain";

function site(id: string, sync_status: Site["sync_status"], updated_at: string): Site {
  return {
    id,
    company_id: "company",
    created_by: null,
    updated_by: null,
    created_at: updated_at,
    updated_at,
    source: "manual",
    sync_status,
    idempotency_key: `idem-${id}`,
    archived: false,
    deleted_at: null,
    name: `Site ${id}`,
    client_name: "Client",
    client_mobile: null,
    address: "Address",
    work_type: "civil",
    start_date: "2026-07-14",
    expected_completion_date: null,
    status: "active",
    budget: 0,
    notes: null,
    progress_percent: 0
  };
}

describe("repository cloud/local merge", () => {
  it("keeps local sites visible when cloud rows do not contain them yet", () => {
    const cloud = [site("cloud-site", "synced", "2026-07-14T09:00:00.000Z")];
    const local = [
      site("cloud-site", "synced", "2026-07-14T08:00:00.000Z"),
      site("new-local-site", "pending", "2026-07-14T10:00:00.000Z"),
      site("synced-but-hidden-by-cloud", "synced", "2026-07-14T11:00:00.000Z")
    ];

    const result = mergeCloudRowsWithLocalPending(cloud, local);

    expect(result.map((row) => row.id)).toEqual(["synced-but-hidden-by-cloud", "new-local-site", "cloud-site"]);
  });

  it("recovers visible site rows from queued insert payloads", () => {
    const pending: PendingMutation[] = [
      {
        id: "mutation-1",
        table: "sites",
        operationType: "insert",
        companyId: "company",
        recordId: "queued-site",
        idempotencyKey: "idem-queued-site",
        payload: site("queued-site", "pending", "2026-07-14T12:00:00.000Z"),
        retryCount: 1,
        lastError: "network retry",
        createdAt: "2026-07-14T12:00:00.000Z",
        updatedAt: "2026-07-14T12:00:00.000Z"
      },
      {
        id: "mutation-2",
        table: "sites",
        operationType: "update",
        companyId: "company",
        recordId: "update-only",
        idempotencyKey: "idem-update",
        payload: { name: "Only changed field" },
        retryCount: 0,
        lastError: null,
        createdAt: "2026-07-14T12:01:00.000Z",
        updatedAt: "2026-07-14T12:01:00.000Z"
      }
    ];

    const result = queuedInsertPayloadsAsRecords(pending, "sites", "company");

    expect(result.map((row) => row.id)).toEqual(["queued-site"]);
  });

  it("does not recover queued inserts that also have a queued delete", () => {
    const pending: PendingMutation[] = [
      {
        id: "mutation-1",
        table: "sites",
        operationType: "insert",
        companyId: "company",
        recordId: "deleted-before-sync",
        idempotencyKey: "idem-deleted-before-sync",
        payload: site("deleted-before-sync", "pending", "2026-07-14T12:00:00.000Z"),
        retryCount: 0,
        lastError: null,
        createdAt: "2026-07-14T12:00:00.000Z",
        updatedAt: "2026-07-14T12:00:00.000Z"
      },
      {
        id: "mutation-2",
        table: "sites",
        operationType: "delete",
        companyId: "company",
        recordId: "deleted-before-sync",
        idempotencyKey: "idem-delete",
        payload: { archived: true, deleted_at: "2026-07-14T12:05:00.000Z" },
        retryCount: 0,
        lastError: null,
        createdAt: "2026-07-14T12:05:00.000Z",
        updatedAt: "2026-07-14T12:05:00.000Z"
      }
    ];

    const result = queuedInsertPayloadsAsRecords(pending, "sites", "company");

    expect(result).toEqual([]);
  });
});
