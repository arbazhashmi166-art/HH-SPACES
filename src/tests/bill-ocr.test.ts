import { describe, expect, it } from "vitest";
import { parseBillText } from "@/services/bill-ocr";

describe("bill OCR parser", () => {
  it("extracts supplier, bill number, GSTIN, item, quantity, rate, and grand total", () => {
    const draft = parseBillText(`
      SHREE GANESH CEMENT TRADERS
      GSTIN 27ABCDE1234F1Z5
      Mobile 9876543210
      Tax Invoice No: SG-1245
      Date: 12/07/2026
      Cement bags Qty 20 Bag Rate 360 Amount 7200
      CGST 648
      SGST 648
      Grand Total Rs 8496.00
    `);

    expect(draft.supplier_name).toContain("SHREE GANESH");
    expect(draft.supplier_mobile).toBe("9876543210");
    expect(draft.bill_number).toBe("SG-1245");
    expect(draft.gst_number).toBe("27ABCDE1234F1Z5");
    expect(draft.material_name).toBe("Cement");
    expect(draft.quantity).toBe("20");
    expect(draft.unit).toBe("Bag");
    expect(draft.rate).toBe("360");
    expect(draft.total).toBe("8496");
  });
});
