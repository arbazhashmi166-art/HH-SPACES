import { formatMoney } from "@/utils/format";
import { rateForItem, type BoqRow, type DetailedEstimateResult, type QuoteMode, type RateContext } from "./rate-calculator";
import type { RateCategory, RateItem } from "./rate-catalog";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export type RateSummaryCard = {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
};

export type RateDashboardSummary = {
  cards: RateSummaryCard[];
  topCategories: Array<{ category: RateCategory; count: number }>;
  pendingPriceUpdates: number;
  averageContractorMarginPercent: number;
};

export type SiteConditionKey =
  | "liftUnavailable"
  | "aboveThirdFloor"
  | "occupiedHouse"
  | "nightWork"
  | "renovation"
  | "difficultParking"
  | "smallQuantity"
  | "fastTrack"
  | "premiumFinish"
  | "monsoonWork";

export type SiteConditionMultiplier = {
  key: SiteConditionKey;
  label: string;
  percent: number;
  reason: string;
};

export type RateComparisonPlan = {
  label: "Economy" | "Standard" | "Premium";
  materialQuality: string;
  labourQuality: string;
  finish: string;
  warranty: string;
  riskLevel: "Low" | "Medium" | "High";
  rate: number;
  total: number;
  profit: number;
};

export type ProfitProtectionResult = {
  healthScore: number;
  riskLevel: "low" | "medium" | "high";
  directCost: number;
  preTaxTotal: number;
  finalTotal: number;
  grossProfit: number;
  marginPercent: number;
  minimumProfitPercent: number;
  safeFloor: number;
  recommendedTotal: number;
  premiumTotal: number;
  conditionImpactTotal: number;
  selectedConditions: Array<SiteConditionMultiplier & { amount: number }>;
  warnings: string[];
  suggestions: string[];
  negotiationMoves: string[];
  comparisonPlans: RateComparisonPlan[];
  transparencyLines: string[];
};

export type CustomerRateBrief = {
  title: string;
  oneLineAnswer: string;
  customerScope: string[];
  customerExclusions: string[];
  talkingPoints: string[];
  hinglishTitle: string;
  hinglishOneLineAnswer: string;
  hinglishScope: string[];
  hinglishExclusions: string[];
  hinglishTalkingPoints: string[];
};

export const siteConditionMultipliers: SiteConditionMultiplier[] = [
  { key: "liftUnavailable", label: "Lift unavailable", percent: 8, reason: "Material lifting and worker fatigue increase cost." },
  { key: "aboveThirdFloor", label: "Above 3rd floor", percent: 5, reason: "Higher movement time and supervision cost." },
  { key: "occupiedHouse", label: "Occupied house", percent: 7, reason: "Protection, cleaning and restricted working space required." },
  { key: "nightWork", label: "Night work", percent: 12, reason: "Night allowance, lighting and supervision required." },
  { key: "renovation", label: "Renovation", percent: 9, reason: "Hidden repair, careful dismantling and rework risk." },
  { key: "difficultParking", label: "Difficult parking", percent: 4, reason: "Unloading, waiting and transport time increase." },
  { key: "smallQuantity", label: "Small quantity", percent: 10, reason: "Minimum visit and setup cost must be protected." },
  { key: "fastTrack", label: "Fast track", percent: 10, reason: "Extra labour, overtime and planning buffer required." },
  { key: "premiumFinish", label: "Premium finish", percent: 14, reason: "Better labour, slower execution and warranty reserve required." },
  { key: "monsoonWork", label: "Monsoon work", percent: 6, reason: "Drying, protection and delay risk increase." }
];

function money(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function percent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function latestRateDate(item: RateItem) {
  const dates = item.details?.rateHistory.map((entry) => entry.date).filter(Boolean) ?? [];
  return dates.sort().at(-1) || item.details?.rateValidityDate || "";
}

function isOlderThan(dateIso: string, days: number, now = new Date("2026-07-21T00:00:00+05:30")) {
  const time = Date.parse(dateIso);
  if (!Number.isFinite(time)) return true;
  return now.getTime() - time > days * 24 * 60 * 60 * 1000;
}

function formatShortDate(dateIso: string | null | undefined) {
  if (!dateIso) return "Not yet";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function minimumProfitForCategory(category: RateCategory) {
  if (category === "Labour Supply") return 8;
  if (category === "Waterproofing" || category === "Waterproof Coating") return 20;
  if (category === "Carpentry" || category === "Furniture" || category === "Modular Kitchen") return 22;
  if (category === "Natural Stone" || category === "Granite" || category === "Marble") return 18;
  if (category === "Demolition" || category === "Repair Maintenance") return 20;
  if (category === "Electrical" || category === "Plumbing") return 16;
  return 15;
}

function categorySuggestions(item: RateItem) {
  const suggestions = new Set<string>();
  if (item.category === "Tiling") {
    suggestions.add("Confirm tile size, brand, pattern, cutouts, grout type and floor level correction.");
    suggestions.add("Add extra cutting charge for niches, mitre edges, diagonal pattern or large format tile.");
  }
  if (item.category === "Waterproofing" || item.category === "Waterproof Coating") {
    suggestions.add("Add surface preparation, pipe junction treatment, flood test and warranty reserve.");
    suggestions.add("Do not quote final waterproofing before checking cracks, slope and leakage source.");
  }
  if (item.category === "Carpentry" || item.category === "Furniture" || item.category === "Modular Kitchen") {
    suggestions.add("Confirm board type, laminate/acrylic brand, hardware brand, shutter finish and installation scope.");
    suggestions.add("Separate countertop, baskets, profile handles, lights and premium hardware from base cabinet rate.");
  }
  if (item.category === "Electrical") {
    suggestions.add("Confirm wire brand, switch brand, DB scope, main line, chasing and POP repair inclusion.");
  }
  if (item.category === "Plaster" || item.category === "Painting") {
    suggestions.add("Check wall dampness, cracks, surface preparation, height and curing/protection requirement.");
  }
  return [...suggestions];
}

export function buildRateAnalyzerSummary(input: {
  catalog: RateItem[];
  customRateCount: number;
  boqRows: BoqRow[];
  cityName: string;
  lastBackupIso?: string | null;
  favouriteCount?: number;
}) {
  const categoryCounts = new Map<RateCategory, number>();
  for (const item of input.catalog) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
  }
  const topCategories = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    .slice(0, 5);
  const labourOnlyCount = input.catalog.filter((item) => item.rates.labourOnly > 0).length;
  const labourMaterialCount = input.catalog.filter((item) => item.rates.labourMaterial > 0).length;
  const recentlyUpdated = input.catalog.filter((item) => !isOlderThan(latestRateDate(item), 45)).length;
  const pendingPriceUpdates = input.catalog.filter((item) => isOlderThan(latestRateDate(item), 120)).length;
  const averageContractorMarginPercent = percent(
    input.catalog.reduce((sum, item) => sum + (item.details?.profitPercentage || 0), 0) / Math.max(input.catalog.length, 1)
  );

  return {
    topCategories,
    pendingPriceUpdates,
    averageContractorMarginPercent,
    cards: [
      { label: "Total saved rates", value: String(input.catalog.length), detail: `${input.customRateCount} custom saved on this phone`, tone: "info" },
      { label: "Labour-only rates", value: String(labourOnlyCount), detail: "Useful when customer gives material", tone: "neutral" },
      { label: "Labour + material", value: String(labourMaterialCount), detail: "Ready customer quoting rates", tone: "success" },
      { label: "Recently updated", value: String(recentlyUpdated), detail: "Updated in last 45 days", tone: "success" },
      { label: "Favourite rates", value: String(input.favouriteCount || 0), detail: "Pin rates from saved templates next", tone: "neutral" },
      { label: "Custom rate sheets", value: String(input.customRateCount), detail: "Imported or manually added", tone: input.customRateCount ? "success" : "neutral" },
      { label: "Average margin", value: `${averageContractorMarginPercent}%`, detail: "Default contractor profit logic", tone: "info" },
      { label: "Pending updates", value: String(pendingPriceUpdates), detail: "Rates older than 120 days", tone: pendingPriceUpdates ? "warning" : "success" },
      { label: "Current market", value: input.cityName, detail: topCategories.map((item) => item.category).slice(0, 2).join(", "), tone: "info" },
      { label: "Last backup", value: formatShortDate(input.lastBackupIso), detail: "Export BOQ/rates to update", tone: input.lastBackupIso ? "success" : "warning" },
      { label: "Quotations from analyzer", value: String(input.boqRows.length), detail: `${formatMoney(input.boqRows.reduce((sum, row) => sum + row.total, 0))} saved BOQ value`, tone: "success" }
    ] satisfies RateSummaryCard[]
  } satisfies RateDashboardSummary;
}

export function analyzeProfitProtection(input: {
  item: RateItem;
  estimate: DetailedEstimateResult;
  quantity: number;
  quoteMode: QuoteMode;
  context: RateContext;
  gstPercent: number;
  selectedConditionKeys: SiteConditionKey[];
}) {
  const minimumProfitPercent = minimumProfitForCategory(input.item.category);
  const directCost = money(input.estimate.baseCost + input.estimate.overheadCost);
  const preTaxTotal = money(input.estimate.sellingPrice - input.estimate.gstCost);
  const grossProfit = money(input.estimate.profitCost);
  const marginPercent = preTaxTotal > 0 ? percent((grossProfit / preTaxTotal) * 100) : 0;
  const selectedConditions = siteConditionMultipliers
    .filter((entry) => input.selectedConditionKeys.includes(entry.key))
    .map((entry) => ({ ...entry, amount: money(input.estimate.sellingPrice * (entry.percent / 100)) }));
  const conditionImpactTotal = selectedConditions.reduce((sum, entry) => sum + entry.amount, 0);
  const minimumProfitAmount = money(directCost * (minimumProfitPercent / 100));
  const safeFloor = money((directCost + minimumProfitAmount + conditionImpactTotal) * (1 + input.gstPercent / 100));
  const recommendedTotal = Math.max(input.estimate.sellingPrice + conditionImpactTotal, safeFloor);
  const premiumTotal = money(recommendedTotal * 1.12);
  const staleRate = isOlderThan(latestRateDate(input.item), 90);
  const warnings: string[] = [];

  if (marginPercent < minimumProfitPercent) {
    warnings.push(`Profit is ${marginPercent}%. Recommended minimum for ${input.item.category} is ${minimumProfitPercent}%.`);
  }
  if (input.estimate.sellingPrice < safeFloor) {
    warnings.push(`Do not quote below ${formatMoney(safeFloor)} unless scope or material quality is reduced.`);
  }
  if (staleRate) {
    warnings.push("Rate is older than 90 days. Confirm current labour/material price before final quote.");
  }
  if (input.quantity <= 0) warnings.push("Quantity is zero. Enter measurement before sending quotation.");
  if (input.quoteMode === "labourOnly") warnings.push("Labour-only quote excludes material, wastage, transport and brand risk.");
  if (input.quoteMode === "materialOnly") warnings.push("Material-only quote excludes labour, supervision and finishing risk.");

  const conditionWarnings = selectedConditions.map((entry) => `${entry.label}: add about ${formatMoney(entry.amount)} because ${entry.reason.toLowerCase()}`);
  const suggestions = [...categorySuggestions(input.item), ...conditionWarnings];
  if (!selectedConditions.length) suggestions.push("Select site conditions to see lift, floor, renovation and fast-track impact.");
  if (input.item.details?.materialWastagePercentage) suggestions.push(`Keep at least ${input.item.details.materialWastagePercentage}% wastage in material planning.`);

  const scorePenalty = warnings.length * 12 + selectedConditions.length * 4 + (staleRate ? 10 : 0) + (marginPercent < minimumProfitPercent ? 18 : 0);
  const healthScore = Math.max(20, Math.min(100, 100 - scorePenalty));
  const riskLevel = healthScore < 58 ? "high" : healthScore < 78 ? "medium" : "low";

  const comparisonPlans: RateComparisonPlan[] = [
    {
      label: "Economy",
      materialQuality: "Budget material",
      labourQuality: "Standard labour",
      finish: "Acceptable finish",
      warranty: "Limited",
      riskLevel: "High",
      rate: rateForItem(input.item, "lowest", input.context),
      total: money(input.quantity * rateForItem(input.item, "lowest", input.context) * (1 + input.gstPercent / 100)),
      profit: money(input.estimate.profitCost * 0.65)
    },
    {
      label: "Standard",
      materialQuality: "Reliable market material",
      labourQuality: "Experienced team",
      finish: "Good site finish",
      warranty: "Normal",
      riskLevel: "Medium",
      rate: input.estimate.perUnitSelling,
      total: recommendedTotal,
      profit: grossProfit
    },
    {
      label: "Premium",
      materialQuality: "Better brand and buffer",
      labourQuality: "Senior team",
      finish: "Premium finish",
      warranty: "Stronger",
      riskLevel: "Low",
      rate: input.quantity > 0 ? money(premiumTotal / input.quantity) : 0,
      total: premiumTotal,
      profit: money(grossProfit * 1.35 + conditionImpactTotal)
    }
  ];

  const negotiationMoves = [
    `Maintain minimum profit: do not go below ${formatMoney(safeFloor)}.`,
    "Reduce price safely by removing optional premium material, warranty reserve or fast-track condition.",
    "If client has fixed budget, reduce scope first, not labour quality.",
    "Use economy only when customer accepts lower finish/risk in writing."
  ];

  const transparencyLines = [
    `Quantity: ${input.quantity} ${input.item.unit}`,
    `Direct cost: labour ${formatMoney(input.estimate.labourCost)} + material ${formatMoney(input.estimate.materialCost)}`,
    `Overhead: ${formatMoney(input.estimate.overheadCost)}`,
    `Profit: ${formatMoney(input.estimate.profitCost)} (${marginPercent}% before GST)`,
    `GST: ${formatMoney(input.estimate.gstCost)} at ${input.gstPercent}%`,
    `Condition impact: ${formatMoney(conditionImpactTotal)}`,
    `Final recommended total: ${formatMoney(recommendedTotal)}`
  ];

  return {
    healthScore,
    riskLevel,
    directCost,
    preTaxTotal,
    finalTotal: input.estimate.sellingPrice,
    grossProfit,
    marginPercent,
    minimumProfitPercent,
    safeFloor,
    recommendedTotal,
    premiumTotal,
    conditionImpactTotal,
    selectedConditions,
    warnings,
    suggestions,
    negotiationMoves,
    comparisonPlans,
    transparencyLines
  } satisfies ProfitProtectionResult;
}

export function buildCustomerRateBrief(input: {
  item: RateItem;
  estimate: DetailedEstimateResult;
  protection: ProfitProtectionResult;
  quantity: number;
  quoteMode: QuoteMode;
}) {
  const mode = input.quoteMode === "labourOnly" ? "labour-only" : input.quoteMode === "materialOnly" ? "material-only" : "labour + material";
  const hinglishMode = input.quoteMode === "labourOnly" ? "sirf labour" : input.quoteMode === "materialOnly" ? "sirf material" : "labour plus material";
  const customerScope = [
    `${input.item.work} on ${mode} basis`,
    `Quantity: ${input.quantity} ${input.item.unit}`,
    `Recommended customer amount: ${formatMoney(input.protection.recommendedTotal)}`,
    ...(input.item.scope || []).slice(0, 4)
  ];
  const exclusions = [
    ...(input.item.details?.exclusions || []).slice(0, 4),
    "Hidden repair, design change, night work and major site restriction unless written in quotation"
  ];
  const hinglishScope = [
    `${input.item.work} ${hinglishMode} basis par`,
    `Quantity: ${input.quantity} ${input.item.unit}`,
    `Customer ko batane wala recommended amount: ${formatMoney(input.protection.recommendedTotal)}`,
    ...(input.item.scope || []).slice(0, 4).map((line) => `Included: ${line}`)
  ];
  const hinglishExclusions = [
    ...(input.item.details?.exclusions || []).slice(0, 4).map((line) => `Extra agar required hua: ${line}`),
    "Hidden repair, design change, night work ya major site restriction quotation me written nahi hai to extra hoga"
  ];

  return {
    title: `${input.item.work} customer explanation`,
    oneLineAnswer: `Tell the customer ${input.item.work} will cost about ${formatMoney(input.protection.recommendedTotal)} for ${input.quantity} ${input.item.unit}, subject to final measurement and material brand.`,
    customerScope,
    customerExclusions: Array.from(new Set(exclusions)),
    talkingPoints: [
      `Rate used: ${formatMoney(input.estimate.perUnitSelling)} per ${input.item.unit}.`,
      `Safe negotiation floor: ${formatMoney(input.protection.safeFloor)}.`,
      `Premium option with better finish/warranty: ${formatMoney(input.protection.premiumTotal)}.`,
      input.protection.warnings[0] || "Measurement, brand and site condition should be confirmed before final commitment."
    ],
    hinglishTitle: `${input.item.work} customer ko samjhane ke liye`,
    hinglishOneLineAnswer: `${input.item.work} ka approx customer amount ${formatMoney(input.protection.recommendedTotal)} rahega for ${input.quantity} ${input.item.unit}. Final measurement, material brand aur site condition confirm hone ke baad final rate lock karna safe rahega.`,
    hinglishScope,
    hinglishExclusions: Array.from(new Set(hinglishExclusions)),
    hinglishTalkingPoints: [
      `Rate approx ${formatMoney(input.estimate.perUnitSelling)} per ${input.item.unit} liya hai.`,
      `Negotiation karte time ${formatMoney(input.protection.safeFloor)} se neeche mat jana.`,
      `Premium finish, better brand aur warranty ke saath ${formatMoney(input.protection.premiumTotal)} tak quote kar sakte hain.`,
      input.protection.warnings[0]
        ? `Customer ko pehle clear karo: ${input.protection.warnings[0]}`
        : "Measurement, brand aur site condition pehle confirm karo, phir final commitment do."
    ]
  } satisfies CustomerRateBrief;
}
