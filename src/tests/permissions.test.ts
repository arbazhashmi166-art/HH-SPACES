import { describe, expect, it } from "vitest";
import { canArchive, canCreate, canUpdate } from "@/services/permissions";

describe("permissions", () => {
  it("keeps viewer read-only", () => {
    expect(canCreate("viewer")).toBe(false);
    expect(canUpdate("viewer")).toBe(false);
    expect(canArchive("viewer", "sites")).toBe(false);
  });

  it("blocks staff from deleting financial records unless allowed", () => {
    expect(canArchive("staff", "expenses")).toBe(false);
    expect(canArchive("staff", "expenses", true)).toBe(true);
  });
});
