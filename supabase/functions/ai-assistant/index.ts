import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type Draft = {
  intent: string;
  confidence: number;
  missing_fields: string[];
  original_text: string;
  draft: Record<string, unknown>;
  response: string;
};

type QueryResult<T> = { data: T[] | null };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function localDraft(message: string): Draft {
  const lower = message.toLowerCase();
  const amount = Number(message.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  if (lower.includes("extra work") || lower.includes("variation") || lower.includes("change order") || lower.includes("additional") || lower.includes("increase amount")) {
    const rate = Number(lower.match(/(?:at|rate|rs|inr)\s*(\d+(?:\.\d+)?)/)?.[1] || 0);
    return {
      intent: "extra_work",
      confidence: amount && rate ? 0.72 : 0.52,
      missing_fields: ["site_id", amount ? "" : "quantity", rate ? "" : "rate"].filter(Boolean),
      original_text: message,
      draft: {
        date: todayIso(),
        work_type: lower.includes("waterproofing") ? "waterproofing" : lower.includes("pop") ? "pop" : lower.includes("electrical") ? "electrical" : "other",
        description: message,
        quantity: amount,
        unit: lower.includes("rft") || lower.includes("running") ? "RFT" : lower.includes("point") ? "Nos" : "Sqft",
        rate,
        amount: amount * rate,
        client_approved: false,
        status: "draft",
        notes: message
      },
      response: "Extra work draft prepared. Select site and approval status before saving."
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
    const partner = lower.includes("arbaz") ? "Arbaz" : lower.includes("sahil") ? "Sahil" : "";
    return {
      intent: "partner_draw",
      confidence: amount && partner ? 0.72 : 0.48,
      missing_fields: [partner ? "" : "partner_name", amount ? "" : "amount"].filter(Boolean),
      original_text: message,
      draft: {
        partner_name: partner,
        date: todayIso(),
        category: lower.includes("profit") ? "profit_share" : lower.includes("emergency") ? "emergency" : lower.includes("advance") ? "advance" : "owner_draw",
        amount,
        payment_mode: lower.includes("cash") ? "cash" : lower.includes("bank") ? "bank_transfer" : "upi",
        site_id: null,
        approved_by: null,
        notes: message
      },
      response: "Partner draw draft prepared. Confirm person, reason, and amount before saving."
    };
  }
  if (lower.includes("cement") || lower.includes("bought") || lower.includes("material")) {
    return {
      intent: "material",
      confidence: 0.6,
      missing_fields: ["site_id"],
      original_text: message,
      draft: { date: todayIso(), material_name: lower.includes("cement") ? "Cement bags" : "Material", quantity: amount, unit: "Nos", rate: 0, total: 0, payment_status: "unpaid" },
      response: "Material draft prepared. Select site and rate before saving."
    };
  }
  if (lower.includes("paid") || lower.includes("payment")) {
    return {
      intent: "client_payment",
      confidence: 0.62,
      missing_fields: ["site_id"],
      original_text: message,
      draft: { payment_date: todayIso(), received_amount: amount, payment_mode: lower.includes("cash") ? "cash" : "upi", notes: message },
      response: "Payment draft prepared. Select site before saving."
    };
  }
  return {
    intent: "unknown",
    confidence: 0.25,
    missing_fields: ["clear action"],
    original_text: message,
    draft: {},
      response: "I can answer business questions or create safe drafts for attendance, material, expense, extra work, partner draws, payment, progress, labour, and reminders."
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function rateFallback(message: string, rateAnalysis: unknown): Draft {
  const analysis = asRecord(rateAnalysis);
  const item = asRecord(analysis.item);
  const quantity = asRecord(analysis.quantity);
  const estimate = asRecord(analysis.estimate);
  const strategy = asRecord(analysis.pricingStrategy);
  const missingFields = asStringArray(analysis.missingFields);
  const warnings = asStringArray(analysis.warnings);
  const work = String(item.work || "Selected work");
  const unit = String(item.unit || "unit");
  const qty = asNumber(quantity.quantity);
  const sellingPrice = asNumber(estimate.sellingPrice);
  const recommendedTotal = asNumber(strategy.recommendedTotal) || sellingPrice;
  const floor = asNumber(strategy.negotiationFloor);
  const premium = asNumber(strategy.premiumTotal);
  const riskLevel = String(strategy.riskLevel || "medium");
  const response = [
    `AI rate review: ${work} for ${qty || "given"} ${unit}.`,
    `Customer estimate is ₹${Math.round(sellingPrice).toLocaleString("en-IN")}. Recommended quote is ₹${Math.round(recommendedTotal).toLocaleString("en-IN")}.`,
    floor ? `Do not negotiate below ₹${Math.round(floor).toLocaleString("en-IN")} unless scope or material quality changes.` : "",
    premium ? `Premium quote option: ₹${Math.round(premium).toLocaleString("en-IN")} for higher-risk or urgent work.` : "",
    `Risk level: ${riskLevel}.`,
    missingFields.length ? `Confirm before final quote: ${missingFields.join(", ")}.` : "",
    warnings.length ? `Watch-outs: ${warnings.slice(0, 3).join(" ")}` : "",
    "Final amount should still be checked after site measurement, brand selection and surface condition."
  ]
    .filter(Boolean)
    .join(" ");

  return {
    intent: "rate_estimate",
    confidence: asNumber(analysis.confidence) || 0.7,
    missing_fields: missingFields,
    original_text: message,
    draft: {
      work,
      unit,
      quantity: qty,
      selling_price: sellingPrice,
      recommended_total: recommendedTotal,
      negotiation_floor: floor,
      premium_total: premium,
      risk_level: riskLevel
    },
    response
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { message, company_id, rate_analysis } = await req.json();
    const hasRateAnalysis = Boolean(rate_analysis && typeof rate_analysis === "object");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    const emptyResult: QueryResult<Record<string, unknown>> = { data: [] };
    const shouldLoadCompany = typeof company_id === "string" && company_id.length > 0;
    const [sites, payments, expenses, materials, extraWorks, partnerDraws] = shouldLoadCompany
      ? await Promise.all([
          supabase.from("sites").select("id,name,client_name,budget,progress_percent,status").eq("company_id", company_id).limit(50),
          supabase.from("client_payments").select("site_id,received_amount,pending_amount,payment_date").eq("company_id", company_id).limit(100),
          supabase.from("expenses").select("site_id,category,amount,date").eq("company_id", company_id).limit(100),
          supabase.from("materials").select("site_id,material_name,total,date,payment_status").eq("company_id", company_id).limit(100),
          supabase.from("extra_works").select("site_id,work_type,description,amount,status,client_approved,date").eq("company_id", company_id).limit(100),
          supabase.from("partner_draws").select("partner_name,category,amount,payment_mode,date,notes").eq("company_id", company_id).limit(100)
        ])
      : [emptyResult, emptyResult, emptyResult, emptyResult, emptyResult, emptyResult];

    if (!openAiKey) {
      return new Response(JSON.stringify({ draft: hasRateAnalysis ? rateFallback(String(message || ""), rate_analysis) : localDraft(String(message || "")), source: "local" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const system = `You are H&H SPACES AI. Use only supplied company records. Return strict JSON with keys:
intent, confidence, missing_fields, original_text, draft, response.
Never say data was saved. Never create final records. If site_id is missing for site records, include "site_id" in missing_fields.
Supported intents include attendance, material, expense, extra_work, partner_draw, client_payment, supplier_payment, progress, labour, reminder, rate_estimate, and unknown.
If rate_analysis is supplied, review that estimate as a construction pricing advisor. Use its item, quantity, estimate, pricing strategy, missing fields and warnings. Do not invent market rates outside the supplied analysis.
Money must be numeric INR values. For questions, intent should be "unknown" and response must cite relevant source counts/totals.`;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: openAiModel,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify({
              message,
              today: todayIso(),
              records: {
                sites: sites.data || [],
                client_payments: payments.data || [],
                expenses: expenses.data || [],
                materials: materials.data || [],
                extra_works: extraWorks.data || [],
                partner_draws: partnerDraws.data || []
              },
              rate_analysis: hasRateAnalysis ? rate_analysis : null
            })
          }
        ]
      })
    });

    if (!openAiResponse.ok) {
      return new Response(JSON.stringify({ draft: localDraft(String(message || "")), source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const json = await openAiResponse.json();
    const content = json.choices?.[0]?.message?.content || "{}";
    const draft = JSON.parse(content);
    return new Response(JSON.stringify({ draft, source: "openai" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "AI failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
