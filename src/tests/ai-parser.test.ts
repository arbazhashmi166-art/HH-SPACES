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

  it("generates a quotation draft without marking it as a saveable record", () => {
    const draft = parseLocalAiDraft("Create quotation for 500 sqft waterproofing at 55 with GST for Kumar site");
    expect(draft.intent).toBe("quotation");
    expect(draft.draft.grand_total).toBe(32450);
    expect(draft.draft.items).toEqual([
      expect.objectContaining({
        quantity: 500,
        rate: 55,
        amount: 27500
      })
    ]);
  });

  it("generates BOQ and WhatsApp style drafts", () => {
    const boq = parseLocalAiDraft("Generate BOQ for 1200 sqft POP at 95");
    expect(boq.intent).toBe("boq");
    expect(boq.draft.estimated_amount).toBe(114000);

    const update = parseLocalAiDraft("Make WhatsApp update for Kondhwa site plaster 70% complete");
    expect(update.intent).toBe("whatsapp_update");
    expect(String(update.draft.message)).toContain("H&H SPACES update");
  });

  it("separates supplier payments and labour profiles from generic payment or attendance", () => {
    const supplier = parseLocalAiDraft("Paid supplier Ramesh 12000 cash for cement bill");
    expect(supplier.intent).toBe("supplier_payment");
    expect(supplier.draft.paid_amount).toBe(12000);

    const labour = parseLocalAiDraft("Add labour Imran mason daily wage 850");
    expect(labour.intent).toBe("labour");
    expect(labour.draft.default_daily_wage).toBe(850);
  });
});
