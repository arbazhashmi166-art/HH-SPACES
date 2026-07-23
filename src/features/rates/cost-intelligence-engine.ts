import { formatMoney } from "@/utils/format";
import { clampNumber, type DetailedEstimateResult, type QuoteMode, type RateContext } from "./rate-calculator";
import type { RateCategory, RateItem } from "./rate-catalog";

export const costIntelligenceVersion = "2026.07.23";

export type RateSourceType =
  | "project_approved"
  | "active_contract"
  | "supplier_quote"
  | "company_master"
  | "historical_actual"
  | "regional_market"
  | "ai_fallback";

export type VerificationStatus = "verified" | "approved" | "imported" | "manual" | "ai_estimated" | "expired";

export type RateSourceRecord = {
  id: string;
  sourceType: RateSourceType;
  sourceName: string;
  unitRate: number;
  unit: string;
  city: string;
  locality?: string;
  effectiveDate: string;
  expiryDate?: string;
  verified: boolean;
  verificationStatus: VerificationStatus;
  observationCount: number;
  locationSimilarity: number;
  specificationSimilarity: number;
  quantitySimilarity: number;
  supplierReliability?: number;
  notes?: string;
};

export type InventoryMovementType = "opening" | "purchase" | "transfer_in" | "return_in" | "issue" | "transfer_out" | "damage" | "wastage" | "reserved";

export type InventoryMovement = {
  type: InventoryMovementType;
  quantity: number;
  unitRate?: number;
};

export type InventoryCheckInput = {
  materialName: string;
  unit: string;
  requiredQuantity: number;
  movements: InventoryMovement[];
  valuationMethod?: "weighted_average" | "fifo";
};

export type InventoryPosition = {
  materialName: string;
  unit: string;
  requiredQuantity: number;
  opening: number;
  purchases: number;
  transfersIn: number;
  returnsIn: number;
  issues: number;
  transfersOut: number;
  damage: number;
  approvedWastage: number;
  reservedQuantity: number;
  availableStock: number;
  shortageQuantity: number;
  purchaseRequirement: number;
  weightedAverageRate: number;
  availableStockValue: number;
  purchaseRequirementValue: number;
  warnings: string[];
};

export type CostIntelligenceInput = {
  item: RateItem;
  estimate: DetailedEstimateResult;
  context: RateContext;
  quantity: number;
  quoteMode: QuoteMode;
  gstPercent: number;
  profitPercent?: number;
  riskPercent?: number;
  overheadPercent?: number;
  sourceRates?: RateSourceRecord[];
  inventoryChecks?: InventoryCheckInput[];
  now?: Date;
};

export type SourceWeightResult = RateSourceRecord & {
  baseWeight: number;
  freshnessMultiplier: number;
  verificationMultiplier: number;
  matchMultiplier: number;
  finalWeight: number;
  outlier: boolean;
  outlierReason?: string;
};

export type ConfidenceResult = {
  score: number;
  label: "Highly Reliable" | "Reliable" | "Review Recommended" | "Low Confidence" | "Insufficient Data";
  reasons: string[];
};

export type CostIntelligenceResult = {
  calculationVersion: string;
  inputData: {
    itemId: string;
    itemName: string;
    category: RateCategory;
    quantity: number;
    unit: string;
    quoteMode: QuoteMode;
    city: string;
  };
  normalizedInput: {
    billableQuantity: number;
    gstPercent: number;
    profitPercent: number;
    riskPercent: number;
    overheadPercent: number;
  };
  sourceRates: SourceWeightResult[];
  recommendedUnitRate: number;
  weightedMedianRate: number;
  materialCalculations: Array<{ label: string; formula: string; amount: number }>;
  labourCalculations: Array<{ label: string; formula: string; amount: number }>;
  logisticsCalculations: Array<{ label: string; formula: string; amount: number }>;
  directCost: number;
  riskAllowance: number;
  overhead: number;
  costBeforeProfit: number;
  profit: number;
  taxableValue: number;
  tax: number;
  finalAmount: number;
  unitRate: number;
  breakEvenRate: number;
  minimumSafeRate: number;
  recommendedSellingRate: number;
  competitiveRate: number;
  premiumSellingRate: number;
  expectedProfit: number;
  profitMarginPercent: number;
  markupPercent: number;
  marketVariancePercent: number;
  supplierVariancePercent: number;
  historicalVariancePercent: number;
  confidence: ConfidenceResult;
  warnings: string[];
  missingData: string[];
  missingScope: string[];
  inventory: InventoryPosition[];
  alternativeScenarios: Array<{ label: string; finalAmount: number; unitRate: number; profitImpact: number; note: string }>;
  explanation: string[];
};

const baseSourceWeights: Record<RateSourceType, number> = {
  project_approved: 35,
  active_contract: 32,
  supplier_quote: 25,
  company_master: 15,
  historical_actual: 15,
  regional_market: 10,
  ai_fallback: 3
};

function money(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function roundPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function safeRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function daysOld(dateIso: string, now: Date) {
  const time = Date.parse(dateIso);
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - time) / (24 * 60 * 60 * 1000)));
}

function freshnessMultiplier(source: RateSourceRecord, now: Date) {
  const age = daysOld(source.effectiveDate, now);
  if (source.expiryDate && Date.parse(source.expiryDate) < now.getTime()) return 0.35;
  if (age <= 30) return 1;
  if (age <= 90) return 0.9;
  if (age <= 180) return 0.75;
  return 0.5;
}

function verificationMultiplier(source: RateSourceRecord) {
  if (source.verificationStatus === "approved") return 1.05;
  if (source.verified) return 1;
  if (source.verificationStatus === "imported" || source.verificationStatus === "manual") return 0.65;
  if (source.verificationStatus === "expired") return 0.45;
  return 0.3;
}

function matchMultiplier(source: RateSourceRecord) {
  const supplier = clampNumber(source.supplierReliability ?? 0.75, 0.1, 1);
  return clampNumber((source.locationSimilarity + source.specificationSimilarity + source.quantitySimilarity + supplier) / 4, 0.1, 1);
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] ?? 0 : (sorted[base] ?? 0) + rest * (next - (sorted[base] ?? 0));
}

export function detectRateOutliers(sources: RateSourceRecord[]) {
  const values = sources.map((source) => source.unitRate).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (values.length < 4) return new Map<string, string>();
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const lowFence = q1 - iqr * 1.5;
  const highFence = q3 + iqr * 1.5;
  const median = quantile(values, 0.5);
  const outliers = new Map<string, string>();

  for (const source of sources) {
    const percentageVariance = Math.abs(safeRatio(source.unitRate - median, median) * 100);
    if (source.unitRate < lowFence || source.unitRate > highFence || percentageVariance >= 45) {
      outliers.set(source.id, `${source.sourceName} differs ${roundPercent(percentageVariance)}% from comparable source median.`);
    }
  }

  return outliers;
}

export function weightRateSources(sources: RateSourceRecord[], now = new Date("2026-07-23T00:00:00+05:30")) {
  const outliers = detectRateOutliers(sources);
  return sources.map((source) => {
    const fresh = freshnessMultiplier(source, now);
    const verified = verificationMultiplier(source);
    const matched = matchMultiplier(source);
    const observationMultiplier = clampNumber(Math.log10(Math.max(1, source.observationCount)) + 0.72, 0.72, 1.45);
    const outlierMultiplier = outliers.has(source.id) ? 0.22 : 1;
    const finalWeight = baseSourceWeights[source.sourceType] * fresh * verified * matched * observationMultiplier * outlierMultiplier;
    return {
      ...source,
      baseWeight: baseSourceWeights[source.sourceType],
      freshnessMultiplier: roundPercent(fresh),
      verificationMultiplier: roundPercent(verified),
      matchMultiplier: roundPercent(matched),
      finalWeight: Math.round(finalWeight * 100) / 100,
      outlier: outliers.has(source.id),
      outlierReason: outliers.get(source.id)
    } satisfies SourceWeightResult;
  });
}

export function weightedMedianRate(weightedSources: SourceWeightResult[]) {
  const valid = weightedSources
    .filter((source) => source.finalWeight > 0 && source.unitRate > 0 && source.unit)
    .sort((a, b) => a.unitRate - b.unitRate);
  if (!valid.length) return 0;
  const totalWeight = valid.reduce((sum, source) => sum + source.finalWeight, 0);
  let running = 0;
  for (const source of valid) {
    running += source.finalWeight;
    if (running >= totalWeight / 2) return money(source.unitRate);
  }
  return money(valid.at(-1)?.unitRate ?? 0);
}

export function calculateConfidence(weightedSources: SourceWeightResult[], missingData: string[], warnings: string[]) {
  const nonAiSources = weightedSources.filter((source) => source.sourceType !== "ai_fallback" && !source.outlier);
  const verifiedCount = nonAiSources.filter((source) => source.verified).length;
  const recentCount = nonAiSources.filter((source) => source.freshnessMultiplier >= 0.9).length;
  const totalWeight = weightedSources.reduce((sum, source) => sum + source.finalWeight, 0);
  const trustedWeight = nonAiSources.reduce((sum, source) => sum + source.finalWeight, 0);
  const weightScore = clampNumber(safeRatio(trustedWeight, Math.max(totalWeight, 1)) * 32, 0, 32);
  const verifiedScore = Math.min(24, verifiedCount * 8);
  const freshnessScore = Math.min(18, recentCount * 6);
  const observationScore = Math.min(16, nonAiSources.reduce((sum, source) => sum + Math.min(4, source.observationCount), 0));
  const penalty = missingData.length * 8 + warnings.length * 4 + weightedSources.filter((source) => source.outlier).length * 7;
  const score = Math.max(10, Math.min(100, Math.round(42 + weightScore + verifiedScore + freshnessScore + observationScore - penalty)));
  const label =
    score >= 90
      ? "Highly Reliable"
      : score >= 75
        ? "Reliable"
        : score >= 55
          ? "Review Recommended"
          : score >= 35
            ? "Low Confidence"
            : "Insufficient Data";
  const reasons = [
    `${verifiedCount} verified source${verifiedCount === 1 ? "" : "s"} matched this calculation.`,
    `${recentCount} source${recentCount === 1 ? "" : "s"} updated within 90 days.`,
    missingData.length ? `Missing: ${missingData.join(", ")}.` : "Required unit, location, date and quantity are present.",
    warnings.length ? `Warnings: ${warnings.slice(0, 2).join(" ")}` : "No critical rate warning found."
  ];

  return { score, label, reasons } satisfies ConfidenceResult;
}

export function calculateInventoryPosition(input: InventoryCheckInput) {
  const movements = input.movements.filter((movement) => Number.isFinite(movement.quantity));
  const sum = (types: InventoryMovementType[]) => movements.filter((movement) => types.includes(movement.type)).reduce((total, movement) => total + Math.max(0, movement.quantity), 0);
  const opening = sum(["opening"]);
  const purchases = sum(["purchase"]);
  const transfersIn = sum(["transfer_in"]);
  const returnsIn = sum(["return_in"]);
  const issues = sum(["issue"]);
  const transfersOut = sum(["transfer_out"]);
  const damage = sum(["damage"]);
  const approvedWastage = sum(["wastage"]);
  const reservedQuantity = sum(["reserved"]);
  const availableStock = money(opening + purchases + transfersIn + returnsIn - issues - transfersOut - damage - approvedWastage - reservedQuantity);
  const purchaseMovements = movements.filter((movement) => movement.type === "purchase" || movement.type === "opening");
  const value = purchaseMovements.reduce((total, movement) => total + Math.max(0, movement.quantity) * Math.max(0, movement.unitRate ?? 0), 0);
  const quantityForValue = purchaseMovements.reduce((total, movement) => total + Math.max(0, movement.quantity), 0);
  const weightedAverageRate = money(quantityForValue > 0 ? value / quantityForValue : 0);
  const requiredQuantity = clampNumber(input.requiredQuantity);
  const shortageQuantity = Math.max(0, money(requiredQuantity - availableStock));
  const warnings: string[] = [];

  if (availableStock < 0) warnings.push(`${input.materialName} stock is negative. Check issue, wastage or transfer entries.`);
  if (shortageQuantity > 0) warnings.push(`${input.materialName} shortage is ${shortageQuantity} ${input.unit}.`);
  if (weightedAverageRate === 0 && requiredQuantity > 0) warnings.push(`${input.materialName} has no purchase rate, so purchase value is incomplete.`);

  return {
    materialName: input.materialName,
    unit: input.unit,
    requiredQuantity,
    opening,
    purchases,
    transfersIn,
    returnsIn,
    issues,
    transfersOut,
    damage,
    approvedWastage,
    reservedQuantity,
    availableStock,
    shortageQuantity,
    purchaseRequirement: shortageQuantity,
    weightedAverageRate,
    availableStockValue: money(Math.max(0, availableStock) * weightedAverageRate),
    purchaseRequirementValue: money(shortageQuantity * weightedAverageRate),
    warnings
  } satisfies InventoryPosition;
}

function buildDefaultSources(item: RateItem, context: RateContext, recommendedRate: number, now: Date): RateSourceRecord[] {
  const details = item.details;
  const rateHistory = details?.rateHistory ?? [];
  const historySources = rateHistory.slice(-4).map((entry, index) => ({
    id: `${item.id}-history-${index}`,
    sourceType: entry.source === "custom" ? "company_master" : entry.source === "market_reference" ? "regional_market" : "historical_actual",
    sourceName: entry.source === "custom" ? "Custom saved rate" : entry.source === "market_reference" ? "Regional market reference" : "Seeded historical rate",
    unitRate: entry.standardRate * context.city.multiplier,
    unit: item.unit,
    city: entry.city || context.city.city,
    locality: details?.areaOrLocality,
    effectiveDate: entry.date,
    verified: entry.source !== "custom",
    verificationStatus: entry.source === "custom" ? "manual" : "verified",
    observationCount: entry.source === "market_reference" ? 3 : 1,
    locationSimilarity: entry.city === context.city.city ? 1 : 0.72,
    specificationSimilarity: 0.86,
    quantitySimilarity: 0.78,
    supplierReliability: 0.76,
    notes: "Generated from existing HH SPACES rate catalog history."
  })) satisfies RateSourceRecord[];

  return [
    {
      id: `${item.id}-master`,
      sourceType: "company_master",
      sourceName: "HH SPACES master rate",
      unitRate: recommendedRate,
      unit: item.unit,
      city: context.city.city,
      locality: details?.areaOrLocality,
      effectiveDate: details?.rateValidityDate || now.toISOString().slice(0, 10),
      verified: Boolean(details?.rateValidityDate),
      verificationStatus: details?.rateValidityDate ? "verified" : "manual",
      observationCount: Math.max(1, historySources.length),
      locationSimilarity: 1,
      specificationSimilarity: 1,
      quantitySimilarity: 0.85,
      supplierReliability: 0.78,
      notes: "Primary deterministic master rate from app database."
    },
    {
      id: `${item.id}-regional-low`,
      sourceType: "regional_market",
      sourceName: `${context.city.city} economy market range`,
      unitRate: item.rates.lowest * context.city.multiplier,
      unit: item.unit,
      city: context.city.city,
      locality: details?.areaOrLocality,
      effectiveDate: details?.rateValidityDate || now.toISOString().slice(0, 10),
      verified: Boolean(details?.rateValidityDate),
      verificationStatus: "verified",
      observationCount: 2,
      locationSimilarity: 1,
      specificationSimilarity: 0.82,
      quantitySimilarity: 0.72,
      supplierReliability: 0.72,
      notes: "Low-side planning rate, not a final quotation by itself."
    },
    {
      id: `${item.id}-regional-premium`,
      sourceType: "regional_market",
      sourceName: `${context.city.city} premium market range`,
      unitRate: item.rates.premium * context.city.multiplier,
      unit: item.unit,
      city: context.city.city,
      locality: details?.areaOrLocality,
      effectiveDate: details?.rateValidityDate || now.toISOString().slice(0, 10),
      verified: Boolean(details?.rateValidityDate),
      verificationStatus: "verified",
      observationCount: 2,
      locationSimilarity: 1,
      specificationSimilarity: 0.82,
      quantitySimilarity: 0.72,
      supplierReliability: 0.72,
      notes: "Premium-side planning rate, used for range comparison."
    },
    ...historySources
  ];
}

function missingScopeForCategory(item: RateItem, mode: QuoteMode) {
  const base = ["Final measurement", "Site access and floor lifting", "GST applicability", "Working hours and completion date"];
  const library: Partial<Record<RateCategory, string[]>> = {
    Tiling: ["Surface levelling", "Waterproofing", "Tile adhesive or cement mortar", "Grout or epoxy grout", "Tile cutting and edge profiles", "Niche/cutouts", "Debris removal", "Final cleaning"],
    Waterproofing: ["Surface preparation", "Crack filling", "Pipe junction treatment", "Corner fillet", "Flood test", "Protective screed", "Warranty terms"],
    "Waterproof Coating": ["Surface preparation", "Crack filling", "Primer coat", "UV protection", "Flood test", "Warranty terms"],
    POP: ["Scaffolding", "Light cut-outs", "Moulding/cove details", "Primer and paint", "Debris cleaning"],
    "False Ceiling": ["Frame specification", "Board grade", "Light and AC cut-outs", "Trapdoor", "Painting", "Scaffolding"],
    Electrical: ["Wire brand and size", "Switch brand", "DB/main line", "Chasing and conduit", "POP repair", "Testing"],
    Plumbing: ["Pipe brand", "Concealed or exposed routing", "Tile breaking", "Pressure testing", "Sanitary fitting scope"],
    Carpentry: ["Board type", "Laminate/acrylic/veneer brand", "Hardware brand", "Edge band", "Transport", "Installation"],
    Furniture: ["Board type", "Hardware brand", "Finish grade", "Transport", "Installation", "Warranty"],
    "Modular Kitchen": ["Plywood/HDHMR grade", "Hardware brand", "Countertop", "Baskets", "Profile handles", "Lights", "Installation"],
    Painting: ["Putty coats", "Primer", "Sanding", "Dampness repair", "Scaffolding", "Colour change"],
    Demolition: ["Debris bagging", "Debris lowering", "Transport", "Municipal dumping charge", "Salvage value"]
  };
  const modeItems =
    mode === "labourOnly"
      ? ["Material purchase and wastage excluded"]
      : mode === "materialOnly"
        ? ["Labour, supervision and finishing excluded"]
        : ["Material brand and labour finish quality"];
  return Array.from(new Set([...base, ...(library[item.category] ?? []), ...modeItems]));
}

function missingDataFor(input: CostIntelligenceInput, sources: RateSourceRecord[]) {
  const missing: string[] = [];
  if (!input.item.unit) missing.push("Unit");
  if (!input.context.city.city) missing.push("City/location");
  if (input.quantity <= 0) missing.push("Quantity");
  if (!sources.some((source) => source.effectiveDate)) missing.push("Rate effective date");
  if (!sources.some((source) => source.verified)) missing.push("Verified source");
  if (!input.item.details?.rateValidityDate) missing.push("Rate validity date");
  return missing;
}

export function buildConstructionCostIntelligence(input: CostIntelligenceInput) {
  const now = input.now ?? new Date("2026-07-23T00:00:00+05:30");
  const quantity = clampNumber(input.quantity);
  const details = input.item.details;
  const directCost = money(input.estimate.labourCost + input.estimate.materialCost);
  const logistics = input.estimate.itemizedLines.filter((line) => ["Transport", "Loading/Unloading", "Height charge", "Small quantity surcharge", "Difficult access", "Demolition", "Debris", "Salvage credit"].includes(line.label));
  const logisticsTotal = money(logistics.reduce((sum, line) => sum + line.amount, 0));
  const riskPercent = clampNumber(input.riskPercent ?? (input.item.category === "Waterproofing" || input.item.category === "Demolition" ? 7 : input.item.category === "Tiling" ? 5 : 4), 0, 60);
  const overheadPercent = clampNumber(input.overheadPercent ?? details?.contractorOverhead ?? 6, 0, 80);
  const profitPercent = clampNumber(input.profitPercent ?? details?.profitPercentage ?? 18, 0, 200);
  const gstPercent = clampNumber(input.gstPercent, 0, 50);
  const riskAllowance = money((directCost + logisticsTotal) * (riskPercent / 100));
  const overhead = money((directCost + logisticsTotal + riskAllowance) * (overheadPercent / 100));
  const costBeforeProfit = directCost + logisticsTotal + riskAllowance + overhead;
  const profit = money(costBeforeProfit * (profitPercent / 100));
  const taxableValue = costBeforeProfit + profit;
  const tax = money(taxableValue * (gstPercent / 100));
  const finalAmount = taxableValue + tax;
  const unitRate = quantity > 0 ? money(finalAmount / quantity) : 0;
  const breakEvenRate = quantity > 0 ? money(costBeforeProfit / quantity) : 0;
  const minimumSafeRate = quantity > 0 ? money((costBeforeProfit * 1.08 * (1 + gstPercent / 100)) / quantity) : 0;
  const recommendedSellingRate = Math.max(unitRate, minimumSafeRate);
  const competitiveRate = quantity > 0 ? money((costBeforeProfit * 1.12 * (1 + gstPercent / 100)) / quantity) : 0;
  const premiumSellingRate = quantity > 0 ? money(recommendedSellingRate * 1.18) : 0;
  const sourceRates = input.sourceRates?.length ? input.sourceRates : buildDefaultSources(input.item, input.context, unitRate, now);
  const missingData = missingDataFor(input, sourceRates);
  const weightedSources = weightRateSources(sourceRates, now);
  const weightedMedian = weightedMedianRate(weightedSources);
  const warnings = weightedSources.filter((source) => source.outlierReason).map((source) => source.outlierReason as string);

  if (weightedMedian && unitRate) {
    const variance = Math.abs(safeRatio(unitRate - weightedMedian, weightedMedian) * 100);
    if (variance > 25) warnings.push(`This calculated unit rate is ${roundPercent(variance)}% away from weighted market median.`);
  }
  if (profitPercent < 12) warnings.push("Profit is below 12%. Review scope before quoting.");
  if (input.item.details?.rateValidityDate && daysOld(input.item.details.rateValidityDate, now) > 120) warnings.push("Master rate is older than 120 days. Confirm with supplier/labour before final quotation.");
  if (input.quoteMode === "labourOnly") warnings.push("Labour-only mode excludes material wastage, transport and brand price risk.");
  if (input.quoteMode === "materialOnly") warnings.push("Material-only mode excludes labour productivity, supervision and finishing risk.");

  const confidence = calculateConfidence(weightedSources, missingData, warnings);
  const inventory = input.inventoryChecks?.map(calculateInventoryPosition) ?? [];
  for (const position of inventory) warnings.push(...position.warnings);

  const marginPercent = taxableValue > 0 ? roundPercent((profit / taxableValue) * 100) : 0;
  const markupPercent = costBeforeProfit > 0 ? roundPercent((profit / costBeforeProfit) * 100) : 0;
  const marketVariancePercent = weightedMedian > 0 ? roundPercent(safeRatio(unitRate - weightedMedian, weightedMedian) * 100) : 0;
  const supplierRate = weightedSources.find((source) => source.sourceType === "supplier_quote" && !source.outlier)?.unitRate ?? 0;
  const historicalRate = weightedSources.find((source) => source.sourceType === "historical_actual" && !source.outlier)?.unitRate ?? 0;
  const supplierVariancePercent = supplierRate > 0 ? roundPercent(safeRatio(unitRate - supplierRate, supplierRate) * 100) : 0;
  const historicalVariancePercent = historicalRate > 0 ? roundPercent(safeRatio(unitRate - historicalRate, historicalRate) * 100) : 0;
  const materialCalculations = [
    {
      label: "Material",
      formula: `${quantity} ${input.item.unit} x material rate + selected wastage/logistics`,
      amount: input.estimate.materialCost
    }
  ];
  const labourCalculations = [
    {
      label: "Labour",
      formula: details?.workerProductivityPerDay
        ? `${quantity} ${input.item.unit} / ${details.workerProductivityPerDay} productivity x labour gang`
        : `${quantity} ${input.item.unit} x labour rate`,
      amount: input.estimate.labourCost
    }
  ];
  const logisticsCalculations = logistics.map((line) => ({
    label: line.label,
    formula: `${line.label} from rate item rule`,
    amount: line.amount
  }));
  const alternativeScenarios = [
    {
      label: "Economy",
      finalAmount: money(finalAmount * 0.88),
      unitRate: quantity > 0 ? money((finalAmount * 0.88) / quantity) : 0,
      profitImpact: money(profit * -0.42),
      note: "Only if material/specification is reduced in writing."
    },
    {
      label: "Standard",
      finalAmount,
      unitRate,
      profitImpact: 0,
      note: "Recommended deterministic quote."
    },
    {
      label: "Premium",
      finalAmount: money(finalAmount * 1.18),
      unitRate: quantity > 0 ? money((finalAmount * 1.18) / quantity) : 0,
      profitImpact: money(finalAmount * 0.18),
      note: "Better brand, finish, warranty and risk buffer."
    }
  ];

  return {
    calculationVersion: costIntelligenceVersion,
    inputData: {
      itemId: input.item.id,
      itemName: input.item.work,
      category: input.item.category,
      quantity,
      unit: input.item.unit,
      quoteMode: input.quoteMode,
      city: input.context.city.city
    },
    normalizedInput: {
      billableQuantity: quantity,
      gstPercent,
      profitPercent,
      riskPercent,
      overheadPercent
    },
    sourceRates: weightedSources,
    recommendedUnitRate: recommendedSellingRate,
    weightedMedianRate: weightedMedian,
    materialCalculations,
    labourCalculations,
    logisticsCalculations,
    directCost,
    riskAllowance,
    overhead,
    costBeforeProfit,
    profit,
    taxableValue,
    tax,
    finalAmount,
    unitRate,
    breakEvenRate,
    minimumSafeRate,
    recommendedSellingRate,
    competitiveRate,
    premiumSellingRate,
    expectedProfit: profit,
    profitMarginPercent: marginPercent,
    markupPercent,
    marketVariancePercent,
    supplierVariancePercent,
    historicalVariancePercent,
    confidence,
    warnings: Array.from(new Set(warnings)),
    missingData,
    missingScope: missingScopeForCategory(input.item, input.quoteMode),
    inventory,
    alternativeScenarios,
    explanation: [
      `Direct cost = labour ${formatMoney(input.estimate.labourCost)} + material ${formatMoney(input.estimate.materialCost)} + logistics ${formatMoney(logisticsTotal)}.`,
      `Risk allowance = direct/logistics subtotal x ${riskPercent}%.`,
      `Overhead = direct cost with risk x ${overheadPercent}%.`,
      `Profit = cost before profit x ${profitPercent}% markup. Profit margin is ${marginPercent}% of taxable value.`,
      `Tax = taxable value x ${gstPercent}%.`,
      `Final amount = ${formatMoney(finalAmount)}, equal to ${formatMoney(unitRate)} / ${input.item.unit}.`,
      `Recommended rate source = weighted median ${formatMoney(weightedMedian)} / ${input.item.unit} using deterministic source weights.`
    ]
  } satisfies CostIntelligenceResult;
}
