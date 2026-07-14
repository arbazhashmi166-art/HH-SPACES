import { todayIso } from "@/utils/format";

export type AiDraft = {
  intent:
    | "attendance"
    | "material"
    | "expense"
    | "client_payment"
    | "supplier_payment"
    | "partner_draw"
    | "progress"
    | "labour"
    | "reminder"
    | "extra_work"
    | "quotation"
    | "boq"
    | "bill"
    | "whatsapp_update"
    | "daily_report"
    | "unknown";
  confidence: number;
  missing_fields: string[];
  original_text: string;
  draft: Record<string, unknown>;
  response: string;
};

function firstNumber(text: string) {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function allNumbers(text: string) {
  return [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1] || 0)).filter((value) => Number.isFinite(value));
}

function afterWords(text: string, words: string[]) {
  const lowered = text.toLowerCase();
  for (const word of words) {
    const index = lowered.indexOf(word);
    if (index >= 0) return text.slice(index + word.length).trim().split(/[,.;]/)[0]?.trim() || "";
  }
  return "";
}

function cleanHint(value: string) {
  return value
    .replace(/\b(site|from|supplier|client|customer|at|rate|rs|inr|each|per|sqft|rft|nos|bags?)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function detectWorkType(lower: string) {
  return ["waterproofing", "electrical", "pop", "plaster", "tiling", "painting", "furniture", "plumbing", "rcc"].find((value) => lower.includes(value)) || "other";
}

function extractQuantityRate(lower: string, text: string) {
  const numbers = allNumbers(text);
  const quantity =
    Number(lower.match(/(\d+(?:\.\d+)?)\s*(?:sqft|sq\.?\s*ft|rft|running|nos|points?|bags?|kg|ton|day)/)?.[1] || 0) ||
    firstNumber(text);
  const rate =
    Number(lower.match(/(?:at|rate|rs|inr|\u20b9)\s*(\d+(?:\.\d+)?)/)?.[1] || 0) ||
    Number(lower.match(/(\d+(?:\.\d+)?)\s*(?:per|\/)\s*(?:sqft|rft|point|bag|day)/)?.[1] || 0) ||
    (numbers.length > 1 ? numbers[1] || 0 : 0);
  return { quantity, rate };
}

function unitFromText(lower: string) {
  if (lower.includes("rft") || lower.includes("running")) return "RFT";
  if (lower.includes("point")) return "Nos";
  if (lower.includes("bag")) return "Bags";
  if (lower.includes("kg")) return "Kg";
  if (lower.includes("ton")) return "Ton";
  if (lower.includes("day")) return "Day";
  return "Sqft";
}

function quotationLikeDraft(input: string, kind: "quotation" | "bill") {
  const text = input.trim();
  const lower = text.toLowerCase();
  const { quantity, rate } = extractQuantityRate(lower, text);
  const amount = quantity * rate;
  const gstPercent = lower.includes("gst") ? Number(lower.match(/(\d+(?:\.\d+)?)\s*%\s*gst|gst\s*(\d+(?:\.\d+)?)/)?.[1] || 18) : 0;
  const gstAmount = Math.round((amount * gstPercent) / 100);
  const workType = detectWorkType(lower);
  const siteHint = cleanHint(afterWords(text, [" for ", " at "]));

  return {
    intent: kind,
    confidence: quantity && rate ? 0.82 : quantity || rate ? 0.56 : 0.38,
    missing_fields: [siteHint ? "" : "site/client name", quantity ? "" : "quantity", rate ? "" : "rate"].filter(Boolean),
    original_text: input,
    draft: {
      document_type: kind === "bill" ? "Bill / Invoice Draft" : "Quotation Draft",
      site_or_client_hint: siteHint,
      work_type: workType,
      items: [
        {
          description: `${workType.toUpperCase()} work`,
          quantity,
          unit: unitFromText(lower),
          rate,
          amount
        }
      ],
      subtotal: amount,
      gst_percent: gstPercent,
      gst_amount: gstAmount,
      grand_total: amount + gstAmount,
      notes: "Review client/site, taxes, terms, and company details before sharing."
    },
    response:
      kind === "bill"
        ? "I prepared a bill draft. Review the client/site, item, GST, and total before creating the final invoice."
        : "I prepared a quotation draft. Review the scope, quantity, rate, GST, and terms before sending it."
  } satisfies AiDraft;
}

function boqDraft(input: string) {
  const text = input.trim();
  const lower = text.toLowerCase();
  const { quantity, rate } = extractQuantityRate(lower, text);
  const workType = detectWorkType(lower);
  return {
    intent: "boq",
    confidence: quantity || rate ? 0.68 : 0.42,
    missing_fields: [workType === "other" ? "work type" : "", quantity ? "" : "estimated quantity", rate ? "" : "estimated rate"].filter(Boolean),
    original_text: input,
    draft: {
      boq_type: workType,
      estimated_quantity: quantity,
      unit: unitFromText(lower),
      estimated_rate: rate,
      estimated_amount: quantity * rate,
      actual_quantity: 0,
      actual_amount: 0,
      variance_amount: quantity * rate,
      control_note: "Use this as a BOQ draft, then compare actual work and cost against it."
    },
    response: "I prepared a BOQ draft with estimated quantity, rate, amount, and variance fields."
  } satisfies AiDraft;
}

function messageDraft(input: string, kind: "whatsapp_update" | "daily_report") {
  const text = input.trim();
  const lower = text.toLowerCase();
  const siteHint = cleanHint(afterWords(text, [" for ", " at ", "site "]));
  const workType = detectWorkType(lower);
  const message =
    kind === "daily_report"
      ? [
          "H&H SPACES - Daily Site Report",
          `Site: ${siteHint || "Select site"}`,
          `Date: ${todayIso()}`,
          `Work update: ${text}`,
          "Labour: Add attendance count",
          "Material: Add received/used details",
          "Issues: Add delay or client instruction",
          "Tomorrow: Add next plan"
        ].join("\n")
      : [
          "H&H SPACES update",
          `Site: ${siteHint || "Select site"}`,
          `Work: ${workType === "other" ? text : workType.toUpperCase()}`,
          `Status: ${text}`,
          "Please confirm if any changes are required."
        ].join("\n");

  return {
    intent: kind,
    confidence: 0.64,
    missing_fields: [siteHint ? "" : "site/client name"].filter(Boolean),
    original_text: input,
    draft: {
      channel: kind === "whatsapp_update" ? "WhatsApp" : "Daily Report",
      site_or_client_hint: siteHint,
      message
    },
    response: kind === "daily_report" ? "I prepared a daily site report draft you can copy to WhatsApp or save as report text." : "I prepared a WhatsApp client update draft."
  } satisfies AiDraft;
}

export function parseLocalAiDraft(input: string): AiDraft {
  const text = input.trim();
  const lower = text.toLowerCase();
  const date = todayIso();

  if (!text) {
    return { intent: "unknown", confidence: 0, missing_fields: ["message"], original_text: input, draft: {}, response: "Type what you want to record." };
  }

  if (lower.includes("quotation") || lower.includes("quote") || lower.includes("estimate rate")) {
    return quotationLikeDraft(input, "quotation");
  }

  if (lower.includes("boq") || lower.includes("bill of quantity") || lower.includes("estimated quantity")) {
    return boqDraft(input);
  }

  if ((lower.includes("make") || lower.includes("create") || lower.includes("generate")) && (lower.includes("bill") || lower.includes("invoice"))) {
    return quotationLikeDraft(input, "bill");
  }

  if (lower.includes("whatsapp") || lower.includes("client update") || lower.includes("send update")) {
    return messageDraft(input, "whatsapp_update");
  }

  if (lower.includes("daily report") || lower.includes("site report") || lower.includes("closing report")) {
    return messageDraft(input, "daily_report");
  }

  if (lower.includes("extra work") || lower.includes("variation") || lower.includes("change order") || lower.includes("additional") || lower.includes("increase amount")) {
    const { quantity, rate } = extractQuantityRate(lower, text);
    const workType = detectWorkType(lower);
    return {
      intent: "extra_work",
      confidence: quantity && rate ? 0.78 : 0.58,
      missing_fields: ["site_id", quantity ? "" : "quantity", rate ? "" : "rate"].filter(Boolean),
      original_text: input,
      draft: {
        date,
        work_type: workType,
        description: text,
        quantity,
        unit: unitFromText(lower),
        rate,
        amount: quantity * rate,
        client_approved: false,
        status: "draft",
        notes: text
      },
      response: "I prepared an extra work draft. Select the site and confirm client approval before saving."
    };
  }

  if (
    lower.includes("partner") ||
    lower.includes("profit share") ||
    lower.includes("emergency money") ||
    lower.includes("owner draw") ||
    lower.includes("withdraw") ||
    (lower.includes("took") && lower.includes("company"))
  ) {
    const amount = firstNumber(text);
    const partner = lower.includes("arbaz") ? "Arbaz" : lower.includes("sahil") ? "Sahil" : afterWords(text, ["partner ", "by ", "for "]) || "";
    const category = lower.includes("profit") ? "profit_share" : lower.includes("emergency") ? "emergency" : lower.includes("advance") ? "advance" : lower.includes("salary") ? "salary" : "owner_draw";
    return {
      intent: "partner_draw",
      confidence: amount && partner ? 0.78 : amount ? 0.55 : 0.35,
      missing_fields: [partner ? "" : "partner_name", amount ? "" : "amount"].filter(Boolean),
      original_text: input,
      draft: {
        partner_name: partner,
        date,
        category,
        amount,
        payment_mode: lower.includes("cash") ? "cash" : lower.includes("bank") ? "bank_transfer" : "upi",
        site_id: null,
        approved_by: null,
        notes: text
      },
      response: "I prepared a partner draw draft. Confirm who took the money, reason, and amount before saving."
    };
  }

  if ((lower.includes("supplier") || lower.includes("vendor")) && (lower.includes("paid") || lower.includes("payment"))) {
    const amount = firstNumber(text);
    const supplierHint = cleanHint(afterWords(text, ["supplier ", "vendor ", "to ", "for "]));
    return {
      intent: "supplier_payment",
      confidence: amount ? 0.64 : 0.36,
      missing_fields: ["supplier_id", amount ? "" : "paid_amount"].filter(Boolean),
      original_text: input,
      draft: {
        payment_date: date,
        supplier_name_hint: supplierHint,
        paid_amount: amount,
        pending_amount: 0,
        payment_mode: lower.includes("cash") ? "cash" : lower.includes("bank") ? "bank_transfer" : "upi",
        bill_reference: afterWords(text, ["bill ", "invoice "]) || null,
        notes: text
      },
      response: "I prepared a supplier payment draft. Select the exact supplier before saving."
    };
  }

  if (lower.includes("cement") || lower.includes("bag") || lower.includes("material") || lower.includes("bought")) {
    const { quantity, rate } = extractQuantityRate(lower, text);
    const siteName = cleanHint(afterWords(text, [" for ", " at "]));
    const supplierName = cleanHint(afterWords(text, [" from ", "supplier "]));
    return {
      intent: "material",
      confidence: rate && quantity ? 0.78 : 0.54,
      missing_fields: ["site_id", quantity ? "" : "quantity", rate ? "" : "rate"].filter(Boolean),
      original_text: input,
      draft: {
        date,
        site_name_hint: siteName,
        material_name: lower.includes("cement") ? "Cement bags" : lower.includes("sand") ? "Sand" : lower.includes("tile") ? "Tiles" : "Material",
        quantity,
        unit: unitFromText(lower),
        rate,
        total: quantity * rate,
        supplier_name: supplierName || null,
        payment_status: "unpaid"
      },
      response: "I prepared a material purchase draft. Select the exact site before saving."
    };
  }

  if ((lower.includes("add") || lower.includes("new")) && lower.includes("labour")) {
    const wage = Number(lower.match(/(\d+)\s*(?:per day|daily|wage|rs|inr)/)?.[1] || lower.match(/(?:per day|daily wage|wage|rs|inr)\s*(\d+)/)?.[1] || 0);
    const workType = ["mason", "helper", "electrician", "painter", "pop", "plumber", "carpenter"].find((value) => lower.includes(value)) || "general";
    const nameHint = cleanHint(text.replace(/add|new|labour|worker|mason|helper|electrician|painter|plumber|carpenter|\d+|wage|daily|per day/gi, " "));
    return {
      intent: "labour",
      confidence: nameHint && wage ? 0.68 : 0.44,
      missing_fields: [nameHint ? "" : "full_name", wage ? "" : "default_daily_wage"].filter(Boolean),
      original_text: input,
      draft: {
        full_name: nameHint,
        mobile: null,
        work_type: workType,
        default_daily_wage: wage,
        site_id: null,
        advance_payment: 0,
        balance_payment: 0,
        status: "active"
      },
      response: "I prepared a labour profile draft. Check name, role, wage, and site before saving."
    };
  }

  if (lower.includes("labour") || lower.includes("present") || lower.includes("absent") || lower.includes("half")) {
    const labourCount = firstNumber(text);
    const wageMatch = lower.match(/(\d+)\s*(?:per day|daily|wage|rs|inr)/);
    const wage = wageMatch ? Number(wageMatch[1]) : 0;
    const absent = Number(lower.match(/(\d+)\s*absent/)?.[1] || 0);
    const half = Number(lower.match(/(\d+)\s*half/)?.[1] || 0);
    const present = Math.max(0, labourCount - absent - half);
    return {
      intent: "attendance",
      confidence: labourCount ? 0.7 : 0.42,
      missing_fields: ["site_id", "labour_id"],
      original_text: input,
      draft: {
        date,
        labour_count: labourCount,
        present,
        half_day: half,
        absent,
        daily_wage: wage,
        wage_amount: present * wage + half * (wage / 2),
        status: "present"
      },
      response: "I prepared an attendance draft. Choose each labour name before saving to prevent duplicate attendance."
    };
  }

  if (lower.includes("paid") || lower.includes("payment") || lower.includes("client")) {
    const amount = firstNumber(text);
    return {
      intent: "client_payment",
      confidence: amount ? 0.68 : 0.38,
      missing_fields: ["site_id"],
      original_text: input,
      draft: {
        payment_date: date,
        received_amount: amount,
        payment_mode: lower.includes("cash") ? "cash" : lower.includes("bank") ? "bank_transfer" : "upi",
        notes: text
      },
      response: "I prepared a client payment draft. Select the site so the pending amount does not mix with another client."
    };
  }

  if (lower.includes("expense") || lower.includes("transport") || lower.includes("food") || lower.includes("diesel")) {
    const amount = firstNumber(text);
    return {
      intent: "expense",
      confidence: amount ? 0.66 : 0.35,
      missing_fields: [],
      original_text: input,
      draft: {
        date,
        category: lower.includes("transport") || lower.includes("diesel") ? "transport" : lower.includes("food") ? "food" : "misc",
        amount,
        payment_mode: lower.includes("cash") ? "cash" : "upi",
        notes: text
      },
      response: "I prepared an expense draft. Add a site if this expense belongs to one site."
    };
  }

  if (lower.includes("progress") || lower.includes("completed") || lower.includes("done")) {
    const percent = Number(lower.match(/(\d+)\s*%/)?.[1] || 0);
    return {
      intent: "progress",
      confidence: percent ? 0.62 : 0.45,
      missing_fields: ["site_id"],
      original_text: input,
      draft: {
        date,
        title: "Daily progress",
        description: text,
        progress_percent: percent
      },
      response: "I prepared a progress update draft. Select the site before saving."
    };
  }

  return {
    intent: "unknown",
    confidence: 0.25,
    missing_fields: ["clear action"],
    original_text: input,
    draft: {},
    response:
      "I can answer business questions and create drafts for attendance, material, expense, extra work, partner draws, client payment, supplier payment, progress, labour, and reminders. Add site/client/material details for a stronger draft."
  };
}
