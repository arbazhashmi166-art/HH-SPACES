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

export type RatePrecision = {
  level: "exact" | "strong" | "planning";
  label: string;
  score: number;
  reason: string;
};

export type RatePlan = {
  label: string;
  quoteMode: QuoteMode;
  rateLevel: RateLevel;
  unitRate: number;
  total: number;
  useCase: string;
};

export type RateAssumption = {
  label: string;
  value: string;
};

export type RateLogicCheck = {
  label: string;
  status: "ok" | "check" | "risk";
  detail: string;
};

export type CustomerRateExplanation = {
  customerSpecification: string;
  plainLanguageSummary: string;
  included: string[];
  notIncluded: string[];
  confirmBeforeFinal: string[];
  talkingPoints: string[];
  logicChecks: RateLogicCheck[];
};

export type RateAiAnalysis = {
  prompt: string;
  intent: RateAiIntent;
  confidence: number;
  precision: RatePrecision;
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
  pricingStrategy: {
    riskLevel: "low" | "medium" | "high";
    riskBufferPercent: number;
    negotiationFloor: number;
    recommendedTotal: number;
    premiumTotal: number;
    profitMarginPercent: number;
    breakEvenTotal: number;
    suggestedPerUnitRate: number;
  } | null;
  assumptions: RateAssumption[];
  ratePlans: RatePlan[];
  formulaLines: string[];
  customerExplanation: CustomerRateExplanation;
  confidenceReasons: string[];
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

function money(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
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
  const haystack = `${work} ${aliases} ${details}`;
  const itemWords = item.work
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  let score = 0;

  if (haystack.includes(text.trim())) score += 24;
  if (itemWords.length && itemWords.every((word) => text.includes(word))) score += 14;
  if (hasAny(text, ["complete bathroom", "bathroom complete"]) && hasAny(work, ["complete bathroom"])) score += 22;
  if (hasAny(text, ["bathroom tiling", "bathroom tile", "toilet tiling", "toilet tile"]) && !hasAny(text, ["wall only", "only wall", "dado only"]) && work.includes("complete bathroom")) {
    score += 18;
  }
  if (hasAny(text, ["2bhk", "3bhk", "complete interior"]) && hasAny(work, ["complete 2bhk", "complete 3bhk", "interior estimate"])) score += 18;
  if (hasAny(text, ["waterproof", "waterproofing"]) && work.includes("waterproof")) score += 14;
  if (hasAny(text, ["labour only", "labor only", "without material"]) && item.rates.labourOnly > 0) score += 4;
  if (hasAny(text, ["with material", "labour and material", "complete"]) && item.rates.labourMaterial > 0) score += 4;

  return terms.reduce((sum, term) => {
    if (work.includes(term)) return sum + 5;
    if (aliases.includes(term)) return sum + 3;
    if (details.includes(term)) return sum + 1;
    return sum;
  }, score);
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

  return uniqueItems([...databaseMatches, ...catalogMatches, ...(fallbackItem ? [fallbackItem] : [])]).sort(
    (a, b) => scoreCatalogItem(b, text) - scoreCatalogItem(a, text) || b.rates.standard - a.rates.standard
  );
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

function buildConfidenceReasons(input: {
  item: RateItem;
  quantity: InferredQuantityResult;
  missingFields: string[];
  warnings: string[];
  quoteMode: QuoteMode;
}) {
  const reasons = [`Matched "${input.item.work}" from the internal rate database.`];
  reasons.push(input.quantity.method === "default" ? "Used default quantity because exact measurement was not found." : `Quantity detected by ${input.quantity.method.replace(/-/g, " ")}.`);
  reasons.push(input.quoteMode === "labourMaterial" ? "Using labour + material pricing." : `Using ${quoteModeLabel(input.quoteMode).toLowerCase()} pricing.`);
  if (input.missingFields.length) reasons.push(`${input.missingFields.length} field needs confirmation before final quotation.`);
  if (input.warnings.length) reasons.push(`${input.warnings.length} risk warning${input.warnings.length === 1 ? "" : "s"} applied.`);
  return reasons;
}

function buildPricingStrategy(input: {
  estimate: DetailedEstimateResult;
  quantity: InferredQuantityResult;
  missingFields: string[];
  warnings: string[];
  context: RateContext;
  gstPercent: number;
}) {
  const riskPoints =
    input.missingFields.length * 12 +
    input.warnings.length * 7 +
    (input.quantity.method === "default" ? 18 : 0) +
    (input.context.contractType === "Luxury" ? 10 : 0);
  const riskLevel: "low" | "medium" | "high" = riskPoints >= 35 ? "high" : riskPoints >= 16 ? "medium" : "low";
  const riskBufferPercent = riskLevel === "high" ? 16 : riskLevel === "medium" ? 10 : 6;
  const breakEvenTotal = money(input.estimate.baseCost + input.estimate.overheadCost + input.estimate.gstCost);
  const negotiationFloor = money((input.estimate.baseCost + input.estimate.overheadCost) * (1 + riskBufferPercent / 100) * (1 + input.gstPercent / 100));
  const recommendedTotal = Math.max(input.estimate.sellingPrice, negotiationFloor);
  const premiumTotal = money(recommendedTotal * (riskLevel === "high" ? 1.18 : riskLevel === "medium" ? 1.12 : 1.08));
  const grossProfit = Math.max(0, recommendedTotal - breakEvenTotal);
  const profitMarginPercent = recommendedTotal > 0 ? Math.round((grossProfit / recommendedTotal) * 100) : 0;
  const suggestedPerUnitRate = input.quantity.quantity > 0 ? money(recommendedTotal / input.quantity.quantity) : 0;

  return {
    riskLevel,
    riskBufferPercent,
    negotiationFloor,
    recommendedTotal,
    premiumTotal,
    profitMarginPercent,
    breakEvenTotal,
    suggestedPerUnitRate
  };
}

function buildPrecision(input: {
  quantity: InferredQuantityResult;
  missingFields: string[];
  warnings: string[];
  confidence: number;
}) {
  const defaultPenalty = input.quantity.method === "default" ? 30 : 0;
  const missingPenalty = input.missingFields.length * 9;
  const warningPenalty = Math.min(input.warnings.length, 4) * 4;
  const score = clamp(Math.round(input.confidence * 100) - defaultPenalty - missingPenalty - warningPenalty + 18, 10, 98);
  const level: RatePrecision["level"] = score >= 82 ? "exact" : score >= 58 ? "strong" : "planning";

  return {
    level,
    score,
    label: level === "exact" ? "Site-ready estimate" : level === "strong" ? "Strong estimate" : "Planning estimate",
    reason:
      level === "exact"
        ? "Clear work item and measurement were detected."
        : level === "strong"
          ? "Main rate is clear, but a few details should be confirmed."
          : "Use this for quick discussion only; exact measurement or scope is still missing."
  };
}

function buildRatePlans(input: {
  item: RateItem;
  quantity: InferredQuantityResult;
  context: RateContext;
  gstPercent: number;
}): RatePlan[] {
  const plans: Array<Pick<RatePlan, "label" | "quoteMode" | "rateLevel" | "useCase">> = [
    { label: "Labour only", quoteMode: "labourOnly", rateLevel: "labourOnly", useCase: "Customer buys all material." },
    { label: "Material only", quoteMode: "materialOnly", rateLevel: "materialOnly", useCase: "Only material supply or stock estimate." },
    { label: "Standard L+M", quoteMode: "labourMaterial", rateLevel: "standard", useCase: "Normal customer quote." },
    { label: "Premium finish", quoteMode: "labourMaterial", rateLevel: "premium", useCase: "Better brand, finish, and supervision." },
    { label: "Luxury finish", quoteMode: "labourMaterial", rateLevel: "luxury", useCase: "High-end design, brand, and detailing." }
  ];

  return plans.map((plan) => {
    const unitRate = rateForItem(input.item, plan.rateLevel, input.context);
    return {
      ...plan,
      unitRate,
      total: money(input.quantity.quantity * unitRate * (1 + input.gstPercent / 100))
    };
  });
}

function buildAssumptions(input: {
  item: RateItem;
  quantity: InferredQuantityResult;
  quoteMode: QuoteMode;
  context: RateContext;
  gstPercent: number;
  text: string;
}) {
  const assumptions: RateAssumption[] = [
    { label: "City rate", value: `${input.context.city.city}, ${input.context.city.state} (${input.context.city.note})` },
    { label: "Project type", value: input.context.contractType },
    { label: "Scope", value: quoteModeLabel(input.quoteMode) },
    { label: "Measurement", value: input.quantity.note },
    { label: "GST", value: `${input.gstPercent}% included in customer total.` }
  ];

  if (input.quantity.heightFt && !hasAny(input.text, ["height", "wall height", " ht", " h "])) {
    assumptions.push({ label: "Default height", value: `${input.quantity.heightFt} ft wall height assumed. Change it for exact bathroom or wall work.` });
  }
  if (input.quantity.wastagePercent && input.quantity.wastagePercent > 0) {
    assumptions.push({ label: "Wastage", value: `${input.quantity.wastagePercent}% wastage included.` });
  }
  if (input.item.details?.minimumCharge) {
    assumptions.push({ label: "Minimum charge", value: `${formatMoney(input.item.details.minimumCharge)} minimum billing protected for small work.` });
  }

  return assumptions;
}

function buildFormulaLines(input: {
  item: RateItem;
  quantity: InferredQuantityResult;
  estimate: DetailedEstimateResult;
  context: RateContext;
}) {
  return [
    input.quantity.note,
    `Adjusted for ${input.context.city.city} and project type before final quote.`,
    `Customer rate: ${formatMoney(input.estimate.perUnitSelling)} / ${input.item.unit}.`,
    ...input.estimate.itemizedLines.map((line) => `${line.label}: ${formatMoney(line.amount)}`)
  ];
}

function buildCustomerExplanation(input: {
  item: RateItem;
  quantity: InferredQuantityResult;
  quoteMode: QuoteMode;
  estimate: DetailedEstimateResult;
  missingFields: string[];
  warnings: string[];
  pricingStrategy: NonNullable<RateAiAnalysis["pricingStrategy"]>;
}) {
  const included = [
    ...input.item.scope,
    input.quoteMode === "labourOnly" ? "Labour execution only" : input.quoteMode === "materialOnly" ? "Material supply estimate only" : "Labour and material basis",
    "Normal site access and standard working hours"
  ].filter(Boolean);
  const exclusions = input.item.details?.exclusions ?? [];
  const notIncluded = [
    ...exclusions,
    input.quoteMode === "labourOnly" ? "Material, wastage, transport and brand price" : "",
    input.quoteMode === "materialOnly" ? "Labour, supervision, finishing and site handling" : "",
    "Major hidden repair, demolition, society restrictions, night work and design changes unless written in scope"
  ].filter(Boolean);
  const confirmBeforeFinal = [
    ...input.missingFields,
    input.quantity.method === "default" ? "Final measurement" : "",
    input.item.category === "Tiling" ? "Tile brand, size, pattern, cutouts, grout type and wastage" : "",
    input.item.category === "Waterproofing" || input.item.category === "Waterproof Coating" ? "Surface condition, crack treatment, slope, flood test and warranty system" : "",
    input.item.category === "Carpentry" || input.item.category === "Furniture" || input.item.category === "Modular Kitchen" ? "Board type, laminate brand, hardware brand, shutter finish and accessories" : "",
    input.item.category === "Electrical" ? "Switch brand, wire brand, DB/main cable scope, chasing and false-ceiling coordination" : "",
    input.item.category === "Painting" ? "Paint brand, putty coats, wall dampness, furniture protection and colour count" : "",
    input.item.category === "POP" || input.item.category === "False Ceiling" ? "Design complexity, light grooves, trap doors, board/POP system and paint inclusion" : ""
  ].filter(Boolean);

  const talkingPoints = [
    `This estimate is for ${input.quantity.quantity} ${input.item.unit} of ${input.item.work}.`,
    `The current customer rate is ${formatMoney(input.estimate.perUnitSelling)} per ${input.item.unit}, making the total ${formatMoney(input.estimate.sellingPrice)}.`,
    `A safe negotiation floor is ${formatMoney(input.pricingStrategy.negotiationFloor)}; below this, scope or quality should be reduced.`,
    input.pricingStrategy.riskLevel === "high"
      ? "Tell the customer this needs site verification before final commitment."
      : "Tell the customer this is workable after confirming measurement and material quality."
  ];

  const logicChecks: RateLogicCheck[] = [
    {
      label: "Work match",
      status: "ok",
      detail: `Matched internal rate item: ${input.item.work}.`
    },
    {
      label: "Measurement",
      status: input.quantity.method === "default" ? "risk" : input.quantity.method === "room-wall-area" || input.quantity.method === "bathroom-area" ? "ok" : "check",
      detail: input.quantity.note
    },
    {
      label: "Scope clarity",
      status: input.missingFields.length ? "check" : "ok",
      detail: input.missingFields.length ? `${input.missingFields.length} detail${input.missingFields.length === 1 ? "" : "s"} still need confirmation.` : "Scope is clear enough for a working quote."
    },
    {
      label: "Risk buffer",
      status: input.pricingStrategy.riskLevel === "high" ? "risk" : input.pricingStrategy.riskLevel === "medium" ? "check" : "ok",
      detail: `${input.pricingStrategy.riskBufferPercent}% buffer applied for ${input.pricingStrategy.riskLevel} risk.`
    },
    {
      label: "Risk warnings",
      status: input.warnings.length ? "check" : "ok",
      detail: input.warnings[0] ?? "No major risk warning detected from the prompt."
    },
    {
      label: "Customer total",
      status: "ok",
      detail: `${formatMoney(input.estimate.sellingPrice)} including GST basis and recorded overhead/profit.`
    }
  ];

  return {
    customerSpecification: `${input.item.work} - ${quoteModeLabel(input.quoteMode)} for ${input.quantity.quantity} ${input.item.unit}. Includes ${included.slice(0, 4).join(", ")}.`,
    plainLanguageSummary: `You can tell the customer: ${input.item.work} will cost about ${formatMoney(input.estimate.sellingPrice)} for ${input.quantity.quantity} ${input.item.unit}, subject to final measurement, material brand and site condition.`,
    included: Array.from(new Set(included)).slice(0, 8),
    notIncluded: Array.from(new Set(notIncluded)).slice(0, 8),
    confirmBeforeFinal: Array.from(new Set(confirmBeforeFinal)).slice(0, 8),
    talkingPoints,
    logicChecks
  };
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
  const premiumPlan = analysis.ratePlans.find((plan) => plan.label === "Premium finish");
  return [
    "H&H SPACES - Smart Estimate",
    `Work: ${analysis.item.work}`,
    `Scope: ${quoteModeLabel(analysis.quoteMode)}`,
    `Qty: ${analysis.quantity.quantity} ${analysis.item.unit}`,
    `Rate: ${formatMoney(analysis.estimate.perUnitSelling)} / ${analysis.item.unit}`,
    `Estimated Total: ${formatMoney(analysis.estimate.sellingPrice)}`,
    `Precision: ${analysis.precision.label} (${analysis.precision.score}%)`,
    analysis.customerExplanation.customerSpecification ? `Specification: ${analysis.customerExplanation.customerSpecification}` : "",
    analysis.customerExplanation.included.length ? `Included: ${analysis.customerExplanation.included.slice(0, 5).join(", ")}` : "",
    analysis.customerExplanation.notIncluded.length ? `Not included: ${analysis.customerExplanation.notIncluded.slice(0, 4).join(", ")}` : "",
    premiumPlan ? `Premium option: ${formatMoney(premiumPlan.total)}` : "",
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
      precision: {
        level: "planning",
        label: "Needs work item",
        score: 10,
        reason: "No matching construction rate item was found."
      },
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
      pricingStrategy: null,
      assumptions: [],
      ratePlans: [],
      formulaLines: [],
      customerExplanation: {
        customerSpecification: "",
        plainLanguageSummary: "I need a clearer work item and measurement before calculating a customer amount.",
        included: [],
        notIncluded: [],
        confirmBeforeFinal: ["Work item", "Measurement"],
        talkingPoints: ["Ask the customer for work type, area, location and material quality."],
        logicChecks: [
          {
            label: "Work match",
            status: "risk",
            detail: "No matching construction rate item was found."
          }
        ]
      },
      confidenceReasons: [],
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
  const confidenceReasons = buildConfidenceReasons({ item, quantity, missingFields, warnings, quoteMode });
  const pricingStrategy = buildPricingStrategy({ estimate, quantity, missingFields, warnings, context: input.context, gstPercent: input.gstPercent });
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
  const precision = buildPrecision({ quantity, missingFields, warnings, confidence: finalConfidence });
  const assumptions = buildAssumptions({ item, quantity, quoteMode, context: input.context, gstPercent: input.gstPercent, text });
  const ratePlans = buildRatePlans({ item, quantity, context: input.context, gstPercent: input.gstPercent });
  const formulaLines = buildFormulaLines({ item, quantity, estimate, context: input.context });
  const customerExplanation = buildCustomerExplanation({ item, quantity, quoteMode, estimate, missingFields, warnings, pricingStrategy });
  const exactness = quantity.method === "default" ? "planning" : "measurement-based";

  return {
    prompt,
    intent,
    confidence: finalConfidence,
    precision,
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
    pricingStrategy,
    assumptions,
    ratePlans,
    formulaLines,
    customerExplanation,
    confidenceReasons,
    missingFields,
    warnings,
    recommendations,
    nextActions: ["Apply to calculator", "Add draft to BOQ", "Copy WhatsApp estimate"],
    source,
    customerSummary: `${item.work}: ${quantity.quantity} ${item.unit} ${quoteModeLabel(quoteMode).toLowerCase()} ${exactness} estimate is ${formatMoney(estimate.sellingPrice)} at ${formatMoney(estimate.perUnitSelling)} / ${item.unit}.`,
    internalSummary: `${item.work}: labour ${formatMoney(estimate.labourCost)}, material ${formatMoney(estimate.materialCost)}, overhead ${formatMoney(estimate.overheadCost)}, profit ${formatMoney(estimate.profitCost)}, GST ${formatMoney(estimate.gstCost)}, customer total ${formatMoney(estimate.sellingPrice)}.`
  };
}
