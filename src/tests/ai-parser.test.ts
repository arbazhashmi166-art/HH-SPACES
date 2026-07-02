import { describe, expect, it } from "vitest";
import { parseLocalAiDraft } from "@/services/ai-parser";

describe("parseLocalAiDraft", () => {
  it("creates a material draft without saving data", () => {
    const draft = parseLocalAiDraft("Bought 20 cement bags at 360 each for Kondhwa site");
    expect(draft.intent).toBe("material");
    expect(draft.draft.quantity).toBe(20);
    expect(draft.draft.total).toBe(7200);
    expect(draft.missing_fields).toContain("site_id");
  });

  it("asks for site when client payment is missing mapping", () => {
    const draft = parseLocalAiDraft("Client paid 25000 cash for terrace work");
    expect(draft.intent).toBe("client_payment");
    expect(draft.missing_fields).toContain("site_id");
  });
});
