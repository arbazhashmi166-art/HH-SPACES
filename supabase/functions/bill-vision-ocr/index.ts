import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type AiDraft = {
  date?: string;
  supplier_name?: string;
  supplier_mobile?: string;
  bill_number?: string;
  gst_number?: string;
  material_name?: string;
  quantity?: string | number;
  unit?: string;
  rate?: string | number;
  total?: string | number;
  notes?: string;
};

const systemPrompt = `You are H&H SPACES AI Bill OCR for Indian construction contractor bills.
Extract bill data from the image. Return only valid JSON with this exact shape:
{
  "confidence": number from 0 to 100,
  "text": "best readable bill text",
  "draft": {
    "date": "YYYY-MM-DD or empty string",
    "supplier_name": "supplier/vendor name",
    "supplier_mobile": "10 digit Indian mobile or empty string",
    "bill_number": "invoice/bill/receipt number or empty string",
    "gst_number": "GSTIN or empty string",
    "material_name": "main purchased item or work/expense name",
    "quantity": "numeric quantity",
    "unit": "Bag, Kg, Ton, Sqft, RFT, Nos, Box, Litre, Sheet, Cum, or empty string",
    "rate": "numeric rate",
    "total": "numeric final payable total",
    "notes": "short verification notes with tax/discount/other readable details"
  },
  "items": [
    { "description": string, "quantity": number, "unit": string, "rate": number, "amount": number, "gst_percent": number, "confidence": number }
  ],
  "warnings": string[]
}
Rules:
- Prefer the final payable/grand total, not phone numbers, GSTIN, date, HSN, or invoice numbers.
- Extract every readable material/work row into items. Do not hide item rows only inside notes.
- If multiple items exist, choose the highest value construction material/work as material_name.
- Do not invent missing values. Use empty string or 0 and add a warning.
- Money must be numeric INR values without currency symbols.
- Dates must be normalized to YYYY-MM-DD when readable.
- This is OCR only. Never say anything was saved.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const openAiModel = Deno.env.get("OPENAI_VISION_MODEL") || Deno.env.get("OPENAI_MODEL") || "gpt-4.1";

    if (!authHeader) return json({ error: "Login required for AI OCR" }, 401);
    if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Supabase function environment is missing" }, 500);
    if (!openAiKey) return json({ error: "OpenAI key is not configured in Supabase secrets" }, 503);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "Login session expired. Login again for AI OCR." }, 401);

    const { imageDataUrl, localText, fileName } = await req.json();
    if (!String(imageDataUrl || "").startsWith("data:image/")) return json({ error: "Send a valid bill image" }, 400);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: openAiModel,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Read this supplier bill/invoice photo and extract JSON only. File: ${String(fileName || "bill-photo")}. Local OCR helper text, if any: ${String(localText || "").slice(0, 2500)}`
              },
              {
                type: "input_image",
                image_url: imageDataUrl
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "construction_bill_ocr",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["confidence", "text", "draft", "items", "warnings"],
              properties: {
                confidence: { type: "number", minimum: 0, maximum: 100 },
                text: { type: "string" },
                draft: {
                  type: "object",
                  additionalProperties: false,
                  required: ["date", "supplier_name", "supplier_mobile", "bill_number", "gst_number", "material_name", "quantity", "unit", "rate", "total", "notes"],
                  properties: {
                    date: { type: "string" },
                    supplier_name: { type: "string" },
                    supplier_mobile: { type: "string" },
                    bill_number: { type: "string" },
                    gst_number: { type: "string" },
                    material_name: { type: "string" },
                    quantity: { type: "string" },
                    unit: { type: "string" },
                    rate: { type: "string" },
                    total: { type: "string" },
                    notes: { type: "string" }
                  }
                },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["description", "quantity", "unit", "rate", "amount", "gst_percent", "confidence"],
                    properties: {
                      description: { type: "string" },
                      quantity: { type: "number" },
                      unit: { type: "string" },
                      rate: { type: "number" },
                      amount: { type: "number" },
                      gst_percent: { type: "number" },
                      confidence: { type: "number", minimum: 0, maximum: 100 }
                    }
                  }
                },
                warnings: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return json({ error: `OpenAI Vision OCR failed: ${detail.slice(0, 300)}` }, 502);
    }

    const result = await response.json();
    const outputText =
      result.output_text ||
      result.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])?.map((part: { text?: string }) => part.text || "")?.join("") ||
      "{}";
    const parsed = safeJson(outputText);
    const draft = normalizeDraft(parsed.draft || {});
    const items = normalizeItems(parsed.items || []);
    const itemNotes = items.length
      ? `\nItems:\n${items.map((item) => `- ${item.description || "Item"}: ${item.quantity || 0} ${item.unit || ""} x ${item.rate || 0} = ${item.amount || 0}`).join("\n")}`
      : "";

    return json({
      confidence: clampNumber(parsed.confidence, 0, 100),
      text: String(parsed.text || ""),
      draft: {
        ...draft,
        notes: `${draft.notes || ""}${itemNotes}`.trim()
      },
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      items,
      source: "openai-vision",
      model: openAiModel
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "AI OCR failed" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("AI OCR response was not valid JSON");
  }
}

function normalizeDraft(input: AiDraft) {
  return {
    date: String(input.date || ""),
    supplier_name: String(input.supplier_name || "").slice(0, 90),
    supplier_mobile: onlyDigits(String(input.supplier_mobile || "")).slice(-10),
    bill_number: String(input.bill_number || "").slice(0, 40),
    gst_number: String(input.gst_number || "").toUpperCase().slice(0, 20),
    material_name: String(input.material_name || "").slice(0, 90),
    quantity: String(toMoney(input.quantity)),
    unit: String(input.unit || ""),
    rate: String(toMoney(input.rate)),
    total: String(toMoney(input.total)),
    notes: String(input.notes || "").slice(0, 1500)
  };
}

function normalizeItems(input: Array<Record<string, unknown>>) {
  return Array.isArray(input)
    ? input
        .map((item) => {
          const quantity = toMoney(item.quantity);
          const rate = toMoney(item.rate);
          const amount = toMoney(item.amount) || quantity * rate;
          return {
            description: String(item.description || "").trim().slice(0, 90),
            quantity,
            unit: String(item.unit || "Nos").trim() || "Nos",
            rate,
            amount: Math.round(amount * 100) / 100,
            gst_percent: toMoney(item.gst_percent),
            confidence: clampNumber(item.confidence, 0, 100)
          };
        })
        .filter((item) => item.description && item.amount > 0)
        .slice(0, 30)
    : [];
}

function toMoney(value: unknown) {
  const normalized = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(normalized) && normalized > 0 ? Math.round(normalized * 100) / 100 : 0;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(min, Math.min(max, Math.round(number)));
}
