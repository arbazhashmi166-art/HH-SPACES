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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function localDraft(message: string): Draft {
  const lower = message.toLowerCase();
  const amount = Number(message.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
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
    response: "I can answer business questions or create safe drafts for attendance, material, expense, payment, progress, labour, and reminders."
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { message, company_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

    const [sites, payments, expenses, materials] = await Promise.all([
      supabase.from("sites").select("id,name,client_name,budget,progress_percent,status").eq("company_id", company_id).limit(50),
      supabase.from("client_payments").select("site_id,received_amount,pending_amount,payment_date").eq("company_id", company_id).limit(100),
      supabase.from("expenses").select("site_id,category,amount,date").eq("company_id", company_id).limit(100),
      supabase.from("materials").select("site_id,material_name,total,date,payment_status").eq("company_id", company_id).limit(100)
    ]);

    if (!openAiKey) {
      return new Response(JSON.stringify({ draft: localDraft(String(message || "")), source: "local" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const system = `You are SiteTracker Pro AI. Use only supplied company records. Return strict JSON with keys:
intent, confidence, missing_fields, original_text, draft, response.
Never say data was saved. Never create final records. If site_id is missing for site records, include "site_id" in missing_fields.
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
                materials: materials.data || []
              }
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
