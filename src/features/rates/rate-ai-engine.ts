import { formatMoney } from "@/utils/format";
import { searchRateDatabase } from "./expanded-rate-database";
import {
  calculateDetailedWorkEstimate,
  defaultQuantityForRateItem,
  inferQuantityFromText,
  rateForItem,
  toBoqRow,
  type BoqRow,
  type DetailedEstimateResult,
  type InferredQuantityResult,
  type QuoteMode,
  type RateContext,
  type RateLevel
} from "./rate-calculator";
import type { RateItem } from "./rate-catalog";

export type RateAiIntent = "quotation" | "boq" | "labour_rate" | "material_rate" | "comparison" | "unknown";

export type RateAiSource = {
  itemId: string;
  work: string;
  category: string;
  city: string;
  rateValidityDate?: string;
};

export type RateAiAnalysis = {
  prompt: string;
  intent: RateAiIntent;
  confidence: number;
  item: RateItem | null;
  alternatives: RateItem[];
  quantity: InferredQuantityResult | null;
  quoteMode: QuoteMode;
  rateLevel: RateLevel;
  includeHeightCharge: boolean;
  includeDifficultAccess: boolean;
  includeSmallQuantitySurcharge: boolean;
  estimate: DetailedEstimateResult | null;
  boqRow: BoqRow | null;
  marketBands: {
    lowest: number;
    standard: number;
    premium: number;
    luxury: number;
    labourOnly: number;
    materialOnly: number;
    labourMaterial: number;
  } | null;
  missingFields: string[];
  warnings: string[];
  recommendations: string[];
  nextActions: string[];
  source: RateAiSource | null;
  customerSummary: string;
  internalSummary: string;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function normalized(text: string) {
  return text.trim().toLowerCase();
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function quoteModeLabel(mode: QuoteMode) {
  if (mode === "labourOnly") return "Labour only";
  if (mode === "materialOnly") return "Material only";
  return "Labour + material";
}

function detectIntent(text: string): RateAiIntent {
  if (!text.trim()) return "unknown";
  if (hasAny(text, ["boq", "bill of quantity", "itemized", "itemised"])) return "boq";
  if (hasAny(text, ["quotation", "quote", "estimate", "customer", "client", "cost"])) return "quotation";
  if (hasAny(text, ["labour only", "labor only", "without material", "only labour", "only labor"])) return "labour_rate";
  if (hasAny(text, ["material only", "only material", "material rate"])) return "material_rate";
  if (hasAny(text, ["compare", "comparison", "premium", "luxury", "standard"])) return "comparison";
  return "quotation";
}

function detectQuoteMode(text: string): QuoteMode {
  if (hasAny(text, ["without material", "labour only", "labor only", "only labour", "only labor", "labour charge", "labor charge"])) {
    return "labourOnly";
  }
  if (hasAny(text, ["material only", "only material", "material rate", "without labour", "without labor"])) {
    return "materialOnly";
  }
  return "labourMaterial";
}

function scoreCatalogItem(item: RateItem, text: string) {
  const terms = text
    .replace(/by/g, "x")
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !["rate", "cost", "price", "with", "only", "work", "for"].includes(term));

  if (!terms.length) return 0;
  const work = `${item.category} ${item.subcategory || ""} ${item.work}`.toLowerCase();
  const aliases = [...item.aliases, ...(item.details?.commonAlternativeNames || [])].join(" ").toLowerCase();
  const details = `${item.specification || ""} ${item.details?.detailedSpecification || ""} ${item.details?.materialConsumptionFormula || ""}`.toLowerCase();

  return terms.reduce((sum, term) => {
    if (work.includes(term)) return sum + 5;
    if (aliases.includes(term)) return sum + 3;
    if (details.includes(term)) return sum + 1;
    return sum;
  }, 0);
}

function uniqueItems(items: RateItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function findBestItems(text: string, catalog: RateItem[], fallbackItem?: RateItem) {
  const databaseMatches = searchRateDatabase(text, 10).filter((item) => catalog.some((catalogItem) => catalogItem.id === item.id));
  const catalogMatches = catalog
    .map((item) => ({ item, score: scoreCatalogItem(item, text) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.item.rates.standard - a.item.rates.standard)
    .slice(0, 10)
    .map((entry) => entry.item);

  return uniqueItems([...databaseMatches, ...catalogMatches, ...(fallbackItem ? [fallbackItem] : [])]);
}

function detectChargeFlags(text: string, item: RateItem, quantity: InferredQuantityResult) {
  const details = item.details;
  const includeHeightCharge =
    hasAny(text, ["height", "external", "exterior", "facade", "scaffold", "rope", "above", "double height", "staircase"]) ||
    Boolean(quantity.heightFt && quantity.heightFt > 10);
  const includeDifficultAccess = hasAny(text, [
    "repair",
    "renovation",
    "restricted",
    "society",
    "night",
    "urgent",
    "emergency",
    "occupied",
    "leakage",
    "difficult",
    "height work"
  ]);
  const productivity = details?.workerProductivityPerDay || defaultQuantityForRateItem(item);
  const includeSmallQuantitySurcharge = quantity.quantity < Math.max(1, productivity * 0.35);

  return { includeHeightCharge, includeDifficultAccess, includeSmallQuantitySurcharge };
}

function buildMissingFields(item: RateItem | null, quantity: InferredQuantityResult | null, text: string) {
  const missing: string[] = [];
  if (!item) missing.push("Work item is not clear");
  if (!quantity || quantity.method === "default") missing.push("Exact measurement or quantity");
  if (item?.unit === "sqft" && hasAny(text, ["bathroom", "toilet", "washroom"]) && !hasAny(text, ["height", "wall height"])) {
    missing.push("Wall height if bathroom wall tiling is required");
  }
  if (hasAny(text, ["waterproof", "leakage"]) && !hasAny(text, ["bathroom", "terrace", "balcony", "tank", "sunken", "podium"])) {
    missing.push("Waterproofing location");
  }
  if (hasAny(text, ["tile", "granite", "marble", "kitchen", "wardrobe"]) && !hasAny(text, ["brand", "quality", "standard", "premium", "luxury"])) {
    missing.push("Material brand or quality grade");
  }
  return missing;
}

function buildWarnings(input: {
  item: RateItem;
  quantity: InferredQuantityResult;
  estimate: DetailedEstimateResult;
  text: string;
  mode: QuoteMode;
  context: RateContext;
}) {
  const warnings: string[] = [];
  if (input.quantity.method === "default") {
    warnings.push("This is a planning estimate because no exact measurement was found.");
  }
  if (input.estimate.productivityDays > 7) {
    warnings.push(`Estimated execution may take about ${input.estimate.productivityDays} working days based on productivity.`);
  }
  if (input.item.caution) warnings.push(input.item.caution);
  if (input.mode === "labourOnly") warnings.push("Material purchase, wastage, transport and brand price are excluded.");
  if (input.mode === "materialOnly") warnings.push("Labour, supervision, site handling and finishing risk are excluded.");
  if (input.context.contractType === "Luxury") warnings.push("Luxury work needs brand, sample approval and tolerance confirmation before final quote.");
  if (hasAny(input.text, ["waterproof", "leakage"])) warnings.push("Waterproofing final rate depends on cracks, slope, surface preparation, flood test and warranty system.");
  if (hasAny(input.text, ["demolition", "dismantling", "remove"])) warnings.push("Demolition estimate should confirm debris lowering, transport, disposal and society restrictions.");
  return warnings;
}

function buildRecommendations(input: {
  item: RateItem;
  quantity: InferredQuantityResult;
  estimate: DetailedEstimateResult;
  text: string;
  missingFields: string[];
}) {
  const recommendations = [
    "Save this as a BOQ draft, then edit quantity after final site measurement.",
    "Tell customer this is an indicative estimate until material brand and site condition are confirmed."
  ];
  if (input.missingFields.length) recommendations.unshift("Ask for the missing details before sending a final quotation.");
  if (input.item.details?.qualityChecklist?.length) {
    recommendations.push(`Quality check: ${input.item.details.qualityChecklist.slice(0, 2).join(", ")}.`);
  }
  if (input.estimate.profitCost > 0) {
    recommendations.push(`This estimate keeps about ${formatMoney(input.estimate.profitCost)} profit before final negotiation.`);
  }
  if (input.quantity.method === "bathroom-area") recommendations.push("Verify bathroom wall height, floor slope, niche work and tile wastage before finalizing.");
  return recommendations;
}

function sourceFor(item: RateItem, context: RateContext): RateAiSource {
  return {
    itemId: item.id,
    work: item.work,
    category: item.category,
    city: context.city.city,
    rateValidityDate: item.details?.rateValidityDate
  };
}

export function analysisToWhatsAppMessage(analysis: RateAiAnalysis) {
  if (!analysis.item || !analysis.quantity || !analysis.estimate) return "Please add work type and measurement for estimate.";
  return [
    "H&H SPACES - Smart Estimate",
    `Work: ${analysis.item.work}`,
    `Scope: ${quoteModeLabel(analysis.quoteMode)}`,
    `Qty: ${analysis.quantity.quantity} ${analysis.item.unit}`,
    `Rate: ${formatMoney(analysis.estimate.perUnitSelling)} / ${analysis.item.unit}`,
    `Estimated Total: ${formatMoney(analysis.estimate.sellingPrice)}`,
    analysis.missingFields.length ? `Need to confirm: ${analysis.missingFields.join(", ")}` : "",
    "Final quote may change after site measurement, material brand, design and surface condition."
  ]
    .filter(Boolean)
    .join("\n");
}

export function analyzeRatePrompt(input: {
  text: string;
  catalog: RateItem[];
  context: RateContext;
  gstPercent: number;
  rateLevel: RateLevel;
  fallbackItem?: RateItem;
  defaultWallHeightFt?: number;
  defaultWastagePercent?: number;
}): RateAiAnalysis {
  const prompt = input.text.trim();
  const text = normalized(prompt);
  const intent = detectIntent(text);
  const quoteMode = detectQuoteMode(text);
  const matches = findBestItems(text, input.catalog, input.fallbackItem);
  const item = matches[0] ?? null;
  const alternatives = matches.slice(1, 5);

  if (!item) {
    return {
      prompt,
      intent,
      confidence: 0.1,
      item: null,
      alternatives: [],
      quantity: null,
      quoteMode,
      rateLevel: input.rateLevel,
      includeHeightCharge: false,
      includeDifficultAccess: false,
      includeSmallQuantitySurcharge: false,
      estimate: null,
      boqRow: null,
      marketBands: null,
      missingFields: ["Work item is not clear", "Exact measurement or quantity"],
      warnings: ["No matching construction rate item was found in the internal rate database."],
      recommendations: ["Try a clearer prompt like: 500 sqft plaster labour only, 4x8 bathroom tiling, or terrace waterproofing 800 sqft."],
      nextActions: ["Search rate list", "Add custom rate"],
      source: null,
      customerSummary: "I need a clearer work item and measurement before calculating a customer amount.",
      internalSummary: "No rate item matched the prompt."
    };
  }

  const quantity = inferQuantityFromText({
    text,
    item,
    defaultWallHeightFt: input.defaultWallHeightFt,
    defaultWastagePercent: input.defaultWastagePercent
  });
  const chargeFlags = detectChargeFlags(text, item, quantity);
  const estimate = calculateDetailedWorkEstimate({
    item,
    context: input.context,
    quantity: quantity.quantity,
    mode: quoteMode,
    ...chargeFlags,
    gstPercent: input.gstPercent
  });
  const missingFields = buildMissingFields(item, quantity, text);
  const warnings = buildWarnings({ item, quantity, estimate, text, mode: quoteMode, context: input.context });
  const recommendations = buildRecommendations({ item, quantity, estimate, text, missingFields });
  const source = sourceFor(item, input.context);
  const marketBands = {
    lowest: rateForItem(item, "lowest", input.context),
    standard: rateForItem(item, "standard", input.context),
    premium: rateForItem(item, "premium", input.context),
    luxury: rateForItem(item, "luxury", input.context),
    labourOnly: rateForItem(item, "labourOnly", input.context),
    materialOnly: rateForItem(item, "materialOnly", input.context),
    labourMaterial: rateForItem(item, "labourMaterial", input.context)
  };
  const boqRow = toBoqRow({
    description: `${item.work} - Smart estimate`,
    unit: item.unit,
    quantity: quantity.quantity,
    rate: estimate.perUnitSelling || rateForItem(item, input.rateLevel, input.context),
    gstPercent: input.gstPercent
  });

  const confidence =
    0.35 +
    (matches.length ? 0.25 : 0) +
    (quantity.method === "default" ? 0 : 0.25) +
    (quoteMode !== "labourMaterial" ? 0.05 : 0.03) -
    missingFields.length * 0.06 -
    Math.min(warnings.length, 3) * 0.03;
  const finalConfidence = clamp(confidence, 0.12, 0.98);
  const exactness = quantity.method === "default" ? "planning" : "measurement-based";

  return {
    prompt,
    intent,
    confidence: finalConfidence,
    item,
    alternatives,
    quantity,
    quoteMode,
    rateLevel: input.rateLevel,
    includeHeightCharge: chargeFlags.includeHeightCharge,
    includeDifficultAccess: chargeFlags.includeDifficultAccess,
    includeSmallQuantitySurcharge: chargeFlags.includeSmallQuantitySurcharge,
    estimate,
    boqRow,
    marketBands,
    missingFields,
    warnings,
    recommendations,
    nextActions: ["Apply to calculator", "Add draft to BOQ", "Copy WhatsApp estimate"],
    source,
    customerSummary: `${item.work}: ${quantity.quantity} ${item.unit} ${quoteModeLabel(quoteMode).toLowerCase()} ${exactness} estimate is ${formatMoney(estimate.sellingPrice)} at ${formatMoney(estimate.perUnitSelling)} / ${item.unit}.`,
    internalSummary: `${item.work}: labour ${formatMoney(estimate.labourCost)}, material ${formatMoney(estimate.materialCost)}, overhead ${formatMoney(estimate.overheadCost)}, profit ${formatMoney(estimate.profitCost)}, GST ${formatMoney(estimate.gstCost)}, customer total ${formatMoney(estimate.sellingPrice)}.`
  };
}
