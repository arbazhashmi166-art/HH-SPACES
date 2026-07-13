import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { transcript } = await req.json();
    const text = String(transcript || "").trim();
    const normalized = text
      .replace(/\brupees\b/gi, "INR")
      .replace(/\bcement bag\b/gi, "cement bags")
      .replace(/\bhalfday\b/gi, "half day")
      .replace(/\bvariation work\b/gi, "extra work");

    return new Response(
      JSON.stringify({
        text: normalized,
        confidence: normalized ? 0.9 : 0,
        missing_fields: normalized ? [] : ["transcript"]
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Voice parser failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
