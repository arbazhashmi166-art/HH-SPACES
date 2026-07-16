import { contractTypeMultipliers, type CityRateProfile, type ContractType, type RateItem, type RateMatrix } from "./rate-catalog";

export type RateLevel = keyof RateMatrix;
export type QuoteMode = "labourOnly" | "materialOnly" | "labourMaterial";

export type RateContext = {
  city: CityRateProfile;
  contractType: ContractType;
  areaPremiumPercent: number;
};

export type QuoteBreakdown = {
  quantity: number;
  unitRate: number;
  labourCost: number;
  materialCost: number;
  baseCost: number;
  overheadCost: number;
  profitCost: number;
  gstCost: number;
  sellingPrice: number;
  perUnitSelling: number;
};

export type DetailedEstimateInput = {
  item: RateItem;
  context: RateContext;
  quantity: number;
  mode: QuoteMode;
  includeHeightCharge: boolean;
  includeDifficultAccess: boolean;
  includeSmallQuantitySurcharge: boolean;
  gstPercent?: number;
};

export type DetailedEstimateLine = {
  label: string;
  amount: number;
};

export type DetailedEstimateResult = QuoteBreakdown & {
  itemizedLines: DetailedEstimateLine[];
  customerRate: number;
  architectRate: number;
  builderRate: number;
  contractorCost: number;
  productivityDays: number;
};

export type BoqRow = {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  amount: number;
  total: number;
};

export type BathroomTileInput = {
  lengthFt: number;
  widthFt: number;
  wallHeightFt: number;
  tileSize: "1x2" | "2x2" | "2x4" | "4x4";
  includeFloor: boolean;
  includeWalls: boolean;
  wastagePercent: number;
  boxCoverageSqft: number;
  selectedRate: number;
  labourOnlyRate: number;
  materialOnlyRate: number;
  marginPercent: number;
  gstPercent: number;
};

export type BathroomTileResult = QuoteBreakdown & {
  wallArea: number;
  floorArea: number;
  totalArea: number;
  areaWithWastage: number;
  tileSqft: number;
  tileQuantity: number;
  tileBoxes: number;
  adhesiveBags: number;
  groutKg: number;
};

export type LabourCalculatorInput = {
  masons: number;
  masonWage: number;
  helpers: number;
  helperWage: number;
  days: number;
  workingHours: number;
  outputQuantity: number;
  marginPercent: number;
};

export type LabourCalculatorResult = {
  totalLabourCost: number;
  effectiveWorkerDays: number;
  averageDailyBurn: number;
  perUnitCost: number;
  sellingPrice: number;
  profit: number;
};

export type MaterialCalculatorInput = {
  workType: "plaster" | "pop" | "waterproofing" | "rcc" | "paint";
  areaSqft: number;
  thicknessMm: number;
};

export type MaterialCalculatorResult = {
  cementBags: number;
  sandCft: number;
  aggregateCft: number;
  popBags: number;
  gypsumBags: number;
  paintLitres: number;
  primerLitres: number;
  puttyKg: number;
  waterproofChemicalLitres: number;
};

export type ElectricalInput = {
  lightPoints: number;
  fanPoints: number;
  plugPoints: number;
  power16aPoints: number;
  acPoints: number;
  geyserPoints: number;
  ledStripRft: number;
  marginPercent: number;
};

export type ElectricalResult = QuoteBreakdown & {
  wireLengthFt: number;
  conduitLengthFt: number;
  pointCount: number;
};

export type CarpenterInput = {
  workAreaSqft: number;
  labourRate: number;
  materialRate: number;
  hardwarePercent: number;
  marginPercent: number;
};

export type CarpenterResult = QuoteBreakdown & {
  plywoodSheets: number;
  laminateSheets: number;
  hardwareCost: number;
};

function money(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function clampNumber(value: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function adjustedRate(rate: number, context: RateContext) {
  const typeMultiplier = contractTypeMultipliers[context.contractType];
  const areaMultiplier = 1 + clampNumber(context.areaPremiumPercent, -30, 100) / 100;
  return money(rate * context.city.multiplier * typeMultiplier * areaMultiplier);
}

export function rateForItem(item: RateItem, level: RateLevel, context: RateContext) {
  return adjustedRate(item.rates[level] || item.rates.standard, context);
}

export function calculateDetailedWorkEstimate(input: DetailedEstimateInput): DetailedEstimateResult {
  const quantity = clampNumber(input.quantity);
  const labourRate = rateForItem(input.item, "labourOnly", input.context);
  const materialRate = rateForItem(input.item, "materialOnly", input.context);
  const details = input.item.details;
  const labourCost = input.mode === "materialOnly" ? 0 : money(quantity * labourRate);
  const materialCost = input.mode === "labourOnly" ? 0 : money(quantity * materialRate);
  const baseCost = labourCost + materialCost;
  const transportCost = money(details ? details.transportCost * Math.max(1, Math.ceil(quantity / Math.max(details.workerProductivityPerDay, 1))) : baseCost * 0.02);
  const loadingCost = money(details ? details.loadingUnloadingCost * Math.max(1, Math.ceil(quantity / Math.max(details.workerProductivityPerDay, 1))) : baseCost * 0.02);
  const heightCharge = input.includeHeightCharge && details ? money(quantity * details.heightCharge) : 0;
  const smallCharge = input.includeSmallQuantitySurcharge && details && quantity < Math.max(1, details.workerProductivityPerDay * 0.35) ? money(quantity * details.smallQuantitySurcharge) : 0;
  const accessCharge = input.includeDifficultAccess && details ? money(quantity * details.difficultAccessSurcharge) : 0;
  const demolitionCost = details ? money(quantity * details.demolitionCost) : 0;
  const debrisCost = details ? money(quantity * details.debrisCost) : 0;
  const salvageCredit = details ? money(quantity * details.salvageValue) : 0;
  const subtotalBeforePercent = baseCost + transportCost + loadingCost + heightCharge + smallCharge + accessCharge + demolitionCost + debrisCost - salvageCredit;
  const supervision = money(subtotalBeforePercent * ((details?.supervisionPercentage || 4) / 100));
  const overhead = money((subtotalBeforePercent + supervision) * ((details?.contractorOverhead || 6) / 100));
  const profit = money((subtotalBeforePercent + supervision + overhead) * ((details?.profitPercentage || 18) / 100));
  const gstCost = money((subtotalBeforePercent + supervision + overhead + profit) * ((input.gstPercent ?? details?.gst ?? 18) / 100));
  const sellingPrice = subtotalBeforePercent + supervision + overhead + profit + gstCost;
  const itemizedLines: DetailedEstimateLine[] = [
    { label: "Labour", amount: labourCost },
    { label: "Material", amount: materialCost },
    { label: "Transport", amount: transportCost },
    { label: "Loading/Unloading", amount: loadingCost },
    { label: "Height charge", amount: heightCharge },
    { label: "Small quantity surcharge", amount: smallCharge },
    { label: "Difficult access", amount: accessCharge },
    { label: "Demolition", amount: demolitionCost },
    { label: "Debris", amount: debrisCost },
    { label: "Salvage credit", amount: -salvageCredit },
    { label: "Supervision", amount: supervision },
    { label: "Overhead", amount: overhead },
    { label: "Profit", amount: profit },
    { label: "GST", amount: gstCost }
  ].filter((line) => line.amount !== 0);

  return {
    quantity,
    unitRate: quantity > 0 ? money(sellingPrice / quantity) : 0,
    labourCost,
    materialCost,
    baseCost,
    overheadCost: overhead,
    profitCost: profit,
    gstCost,
    sellingPrice,
    perUnitSelling: quantity > 0 ? money(sellingPrice / quantity) : 0,
    itemizedLines,
    customerRate: details ? money(quantity * adjustedRate(details.recommendedCustomerRate, input.context)) : money(quantity * rateForItem(input.item, "standard", input.context)),
    architectRate: money(quantity * rateForItem(input.item, "architect", input.context)),
    builderRate: money(quantity * rateForItem(input.item, "builder", input.context)),
    contractorCost: details ? money(quantity * adjustedRate(details.contractorCostRate, input.context)) : baseCost,
    productivityDays: details && details.workerProductivityPerDay > 0 ? Math.ceil(quantity / details.workerProductivityPerDay) : 1
  };
}

export function calculateQuoteBreakdown(params: {
  quantity: number;
  labourRate: number;
  materialRate: number;
  mode: QuoteMode;
  overheadPercent: number;
  marginPercent: number;
  gstPercent: number;
}): QuoteBreakdown {
  const quantity = clampNumber(params.quantity);
  const labourCost = params.mode === "materialOnly" ? 0 : money(quantity * clampNumber(params.labourRate));
  const materialCost = params.mode === "labourOnly" ? 0 : money(quantity * clampNumber(params.materialRate));
  const baseCost = labourCost + materialCost;
  const overheadCost = money(baseCost * (clampNumber(params.overheadPercent, 0, 100) / 100));
  const profitCost = money((baseCost + overheadCost) * (clampNumber(params.marginPercent, 0, 300) / 100));
  const subtotal = baseCost + overheadCost + profitCost;
  const gstCost = money(subtotal * (clampNumber(params.gstPercent, 0, 50) / 100));
  const sellingPrice = subtotal + gstCost;

  return {
    quantity,
    unitRate: quantity > 0 ? money(sellingPrice / quantity) : 0,
    labourCost,
    materialCost,
    baseCost,
    overheadCost,
    profitCost,
    gstCost,
    sellingPrice,
    perUnitSelling: quantity > 0 ? money(sellingPrice / quantity) : 0
  };
}

export function calculateBathroomTiles(input: BathroomTileInput): BathroomTileResult {
  const length = clampNumber(input.lengthFt);
  const width = clampNumber(input.widthFt);
  const height = clampNumber(input.wallHeightFt);
  const floorArea = input.includeFloor ? length * width : 0;
  const wallArea = input.includeWalls ? 2 * (length + width) * height : 0;
  const totalArea = money(floorArea + wallArea);
  const areaWithWastage = Math.ceil(totalArea * (1 + clampNumber(input.wastagePercent, 0, 60) / 100));
  const [tileLength, tileWidth] = input.tileSize.split("x").map(Number) as [number, number];
  const tileSqft = tileLength * tileWidth;
  const tileQuantity = tileSqft > 0 ? Math.ceil(areaWithWastage / tileSqft) : 0;
  const tileBoxes = Math.ceil(areaWithWastage / Math.max(input.boxCoverageSqft, 1));
  const adhesiveBags = Math.ceil(areaWithWastage / 55);
  const groutKg = Math.ceil(areaWithWastage / 75);
  const quote = calculateQuoteBreakdown({
    quantity: areaWithWastage,
    labourRate: input.labourOnlyRate,
    materialRate: input.materialOnlyRate,
    mode: "labourMaterial",
    overheadPercent: 3,
    marginPercent: input.marginPercent,
    gstPercent: input.gstPercent
  });
  const selectedBase = money(areaWithWastage * input.selectedRate);
  const selectedProfit = money(selectedBase * (clampNumber(input.marginPercent, 0, 300) / 100));
  const selectedGst = money((selectedBase + selectedProfit) * (clampNumber(input.gstPercent, 0, 50) / 100));

  return {
    ...quote,
    baseCost: selectedBase,
    profitCost: selectedProfit,
    gstCost: selectedGst,
    sellingPrice: selectedBase + selectedProfit + selectedGst,
    perUnitSelling: areaWithWastage > 0 ? money((selectedBase + selectedProfit + selectedGst) / areaWithWastage) : 0,
    wallArea,
    floorArea,
    totalArea,
    areaWithWastage,
    tileSqft,
    tileQuantity,
    tileBoxes,
    adhesiveBags,
    groutKg
  };
}

export function calculateLabour(input: LabourCalculatorInput): LabourCalculatorResult {
  const days = clampNumber(input.days);
  const masons = clampNumber(input.masons);
  const helpers = clampNumber(input.helpers);
  const totalLabourCost = money(days * (masons * clampNumber(input.masonWage) + helpers * clampNumber(input.helperWage)));
  const effectiveWorkerDays = (masons + helpers) * days;
  const averageDailyBurn = days > 0 ? money(totalLabourCost / days) : 0;
  const perUnitCost = input.outputQuantity > 0 ? money(totalLabourCost / input.outputQuantity) : 0;
  const profit = money(totalLabourCost * (clampNumber(input.marginPercent, 0, 300) / 100));

  return {
    totalLabourCost,
    effectiveWorkerDays,
    averageDailyBurn,
    perUnitCost,
    sellingPrice: totalLabourCost + profit,
    profit
  };
}

export function calculateMaterials(input: MaterialCalculatorInput): MaterialCalculatorResult {
  const area = clampNumber(input.areaSqft);
  const thickness = clampNumber(input.thicknessMm, 1, 250);

  if (input.workType === "plaster") {
    const thicknessFactor = thickness / 12;
    return {
      cementBags: Math.ceil((area / 100) * 1.5 * thicknessFactor),
      sandCft: Math.ceil((area / 100) * 5 * thicknessFactor),
      aggregateCft: 0,
      popBags: 0,
      gypsumBags: 0,
      paintLitres: 0,
      primerLitres: 0,
      puttyKg: 0,
      waterproofChemicalLitres: 0
    };
  }

  if (input.workType === "pop") {
    return {
      cementBags: 0,
      sandCft: 0,
      aggregateCft: 0,
      popBags: Math.ceil(area / 80),
      gypsumBags: Math.ceil(area / 100),
      paintLitres: 0,
      primerLitres: 0,
      puttyKg: 0,
      waterproofChemicalLitres: 0
    };
  }

  if (input.workType === "waterproofing") {
    return {
      cementBags: Math.ceil(area / 180),
      sandCft: Math.ceil(area / 35),
      aggregateCft: 0,
      popBags: 0,
      gypsumBags: 0,
      paintLitres: 0,
      primerLitres: 0,
      puttyKg: 0,
      waterproofChemicalLitres: Math.ceil(area / 35)
    };
  }

  if (input.workType === "rcc") {
    const cubicFeet = area * (thickness / 304.8);
    return {
      cementBags: Math.ceil(cubicFeet / 14),
      sandCft: Math.ceil(cubicFeet * 0.45),
      aggregateCft: Math.ceil(cubicFeet * 0.9),
      popBags: 0,
      gypsumBags: 0,
      paintLitres: 0,
      primerLitres: 0,
      puttyKg: 0,
      waterproofChemicalLitres: 0
    };
  }

  return {
    cementBags: 0,
    sandCft: 0,
    aggregateCft: 0,
    popBags: 0,
    gypsumBags: 0,
    paintLitres: Math.ceil(area / 90),
    primerLitres: Math.ceil(area / 120),
    puttyKg: Math.ceil(area / 18),
    waterproofChemicalLitres: 0
  };
}

export function calculateElectrical(input: ElectricalInput): ElectricalResult {
  const pointCount = input.lightPoints + input.fanPoints + input.plugPoints + input.power16aPoints + input.acPoints + input.geyserPoints;
  const wireLengthFt = Math.ceil(input.lightPoints * 35 + input.fanPoints * 40 + input.plugPoints * 35 + input.power16aPoints * 65 + input.acPoints * 85 + input.geyserPoints * 75 + input.ledStripRft * 1.25);
  const conduitLengthFt = Math.ceil(wireLengthFt * 0.55);
  const labourCost = money(input.lightPoints * 350 + input.fanPoints * 380 + input.plugPoints * 350 + input.power16aPoints * 500 + input.acPoints * 700 + input.geyserPoints * 650 + input.ledStripRft * 75);
  const materialCost = money(input.lightPoints * 600 + input.fanPoints * 650 + input.plugPoints * 600 + input.power16aPoints * 1200 + input.acPoints * 1900 + input.geyserPoints * 1500 + input.ledStripRft * 305);
  const baseCost = labourCost + materialCost;
  const overheadCost = money(baseCost * 0.05);
  const profitCost = money((baseCost + overheadCost) * (clampNumber(input.marginPercent, 0, 300) / 100));
  const gstCost = money((baseCost + overheadCost + profitCost) * 0.18);
  const sellingPrice = baseCost + overheadCost + profitCost + gstCost;

  return {
    quantity: Math.max(pointCount, 1),
    unitRate: pointCount > 0 ? money(sellingPrice / pointCount) : sellingPrice,
    labourCost,
    materialCost,
    baseCost,
    overheadCost,
    profitCost,
    gstCost,
    sellingPrice,
    perUnitSelling: pointCount > 0 ? money(sellingPrice / pointCount) : sellingPrice,
    wireLengthFt,
    conduitLengthFt,
    pointCount
  };
}

export function calculateCarpentry(input: CarpenterInput): CarpenterResult {
  const area = clampNumber(input.workAreaSqft);
  const plywoodSheets = Math.ceil(area / 32);
  const laminateSheets = Math.ceil(area / 32);
  const labourCost = money(area * clampNumber(input.labourRate));
  const materialBeforeHardware = money(area * clampNumber(input.materialRate));
  const hardwareCost = money(materialBeforeHardware * (clampNumber(input.hardwarePercent, 0, 80) / 100));
  const materialCost = materialBeforeHardware + hardwareCost;
  const quote = calculateQuoteBreakdown({
    quantity: area,
    labourRate: input.labourRate,
    materialRate: input.materialRate + (area > 0 ? hardwareCost / area : 0),
    mode: "labourMaterial",
    overheadPercent: 4,
    marginPercent: input.marginPercent,
    gstPercent: 18
  });

  return {
    ...quote,
    labourCost,
    materialCost,
    baseCost: labourCost + materialCost,
    plywoodSheets,
    laminateSheets,
    hardwareCost
  };
}

export function toBoqRow(params: { description: string; unit: string; quantity: number; rate: number; gstPercent: number }): BoqRow {
  const quantity = clampNumber(params.quantity);
  const rate = clampNumber(params.rate);
  const amount = money(quantity * rate);
  const gst = money(amount * (clampNumber(params.gstPercent, 0, 50) / 100));

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: params.description,
    unit: params.unit,
    quantity,
    rate,
    gstPercent: params.gstPercent,
    amount,
    total: amount + gst
  };
}

export function boqTotals(rows: BoqRow[]) {
  const amount = rows.reduce((sum, row) => sum + row.amount, 0);
  const gst = rows.reduce((sum, row) => sum + (row.total - row.amount), 0);
  return {
    amount: money(amount),
    gst: money(gst),
    total: money(amount + gst)
  };
}

export function rowsToCsv(rows: BoqRow[]) {
  const header = ["Sr No", "Description", "Unit", "Quantity", "Rate", "Amount", "GST %", "Total"];
  const body = rows.map((row, index) => [
    index + 1,
    row.description,
    row.unit,
    row.quantity,
    row.rate,
    row.amount,
    row.gstPercent,
    row.total
  ]);
  return [header, ...body]
    .map((line) =>
      line
        .map((cell) => {
          const value = String(cell);
          return value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",")
    )
    .join("\n");
}
