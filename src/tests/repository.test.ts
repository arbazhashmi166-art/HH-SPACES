import { describe, expect, it } from "vitest";
import { mergeCloudRowsWithLocalPending } from "@/lib/repository";
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
});
