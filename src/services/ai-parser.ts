import { todayIso } from "@/utils/format";

export type AiDraft = {
  intent: "attendance" | "material" | "expense" | "client_payment" | "supplier_payment" | "progress" | "labour" | "reminder" | "unknown";
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

function afterWords(text: string, words: string[]) {
  const lowered = text.toLowerCase();
  for (const word of words) {
    const index = lowered.indexOf(word);
    if (index >= 0) return text.slice(index + word.length).trim().split(/[,.;]/)[0]?.trim();
  }
  return "";
}

export function parseLocalAiDraft(input: string): AiDraft {
  const text = input.trim();
  const lower = text.toLowerCase();
  const date = todayIso();

  if (!text) {
    return { intent: "unknown", confidence: 0, missing_fields: ["message"], original_text: input, draft: {}, response: "Type what you want to record." };
  }

  if (lower.includes("cement") || lower.includes("bag") || lower.includes("material") || lower.includes("bought")) {
    const quantity = firstNumber(text);
    const rateMatch = lower.match(/(?:at|rate|rs|inr)\s*(\d+(?:\.\d+)?)/);
    const rate = rateMatch ? Number(rateMatch[1]) : 0;
    const siteName = afterWords(text, [" for ", " at "]);
    return {
      intent: "material",
      confidence: rate && quantity ? 0.78 : 0.54,
      missing_fields: ["site_id", rate ? "" : "rate"].filter(Boolean),
      original_text: input,
      draft: {
        date,
        site_name_hint: siteName,
        material_name: lower.includes("cement") ? "Cement bags" : "Material",
        quantity,
        unit: lower.includes("bag") ? "Bags" : "Nos",
        rate,
        total: quantity * rate,
        payment_status: "unpaid"
      },
      response: "I prepared a material purchase draft. Select the exact site before saving."
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
      "I can answer business questions and create drafts for attendance, material, expense, client payment, supplier payment, progress, labour, and reminders. Add site/client/material details for a stronger draft."
  };
}
