import { describe, expect, it } from "vitest";
import { explainSyncIssue } from "@/features/sync/useSyncStatus";

describe("sync status messages", () => {
  it("explains Supabase schema-cache failures as a database update", () => {
    expect(explainSyncIssue("PGRST204 | Could not find the 'sync_status' column of 'materials' in the schema cache")).toBe(
      "Supabase database tables are missing or outdated. Run supabase/schema.sql in Supabase SQL Editor, then tap Check Again."
    );
  });

  it("explains cloud permission failures without exposing raw technical errors", () => {
    expect(explainSyncIssue("42501 | permission denied for table materials")).toBe(
      "Supabase security rules blocked the upload. Run the latest supabase/schema.sql once, then tap Retry Sync."
    );
  });
});
