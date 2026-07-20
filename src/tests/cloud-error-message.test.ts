import { describe, expect, it } from "vitest";
import { friendlyCloudWriteMessage } from "@/utils/cloud-error-message";

describe("friendlyCloudWriteMessage", () => {
  it("does not expose raw schema-cache errors to users", () => {
    expect(friendlyCloudWriteMessage({ code: "PGRST204", message: "Could not find the table public.companies in the schema cache" })).toContain(
      "Supabase tables are missing or outdated"
    );
  });

  it("maps row level security errors to a role/access message", () => {
    expect(friendlyCloudWriteMessage({ message: "new row violates row-level security policy" })).toContain("Supabase security blocked");
  });

  it("maps network failures to a retryable phone-safe message", () => {
    expect(friendlyCloudWriteMessage({ message: "Failed to fetch" })).toContain("Your changes can still be saved on this phone");
  });
});
