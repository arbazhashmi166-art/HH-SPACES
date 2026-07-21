import { describe, expect, test } from "vitest";
import {
  adjustedRate,
  boqTotals,
  calculateBathroomTiles,
  calculateDetailedWorkEstimate,
  calculateElectrical,
  calculateLabour,
  calculateMaterials,
  inferQuantityFromText,
  rowsToCsv,
  toBoqRow
} from "@/features/rates/rate-calculator";
import { analysisToWhatsAppMessage, analyzeRatePrompt } from "@/features/rates/rate-ai-engine";
import { analyzeProfitProtection, buildCustomerRateBrief, buildRateAnalyzerSummary } from "@/features/rates/rate-intelligence-engine";
import { cityRateProfiles } from "@/features/rates/rate-catalog";
import { constructionRateStats, expandedRateCatalog, searchRateDatabase } from "@/features/rates/expanded-rate-database";

const pune = cityRateProfiles.find((city) => city.city === "Pune")!;
const mumbai = cityRateProfiles.find((city) => city.city === "Mumbai")!;

describe("rate intelligence calculations", () => {
  test("expands the construction database across all major trades", () => {
    expect(constructionRateStats.itemCount).toBeGreaterThan(700);
    expect(constructionRateStats.categoryCount).toBeGreaterThanOrEqual(28);
    expect(searchRateDatabase("shower niche labour charge", 5)[0]?.work).toContain("Niche");
    expect(searchRateDatabase("quartz basin top fitting rate", 5)[0]?.work).toContain("Quartz");
    expect(searchRateDatabase("AC point with 50 metre wiring", 5)[0]?.work).toContain("AC");
    expect(searchRateDatabase("complete 2BHK interior estimate", 5)[0]?.work).toContain("2BHK");
  });

  test("stores required estimator fields for every expanded work item", () => {
    for (const item of expandedRateCatalog) {
      expect(item.details?.measurementFormula, item.work).toBeTruthy();
      expect(item.details?.minimumCharge, item.work).toBeGreaterThan(0);
      expect(item.details?.labourOnly.standard, item.work).toBeGreaterThanOrEqual(0);
      expect(item.details?.labourPlusMaterial.standard, item.work).toBeGreaterThan(0);
      expect(item.details?.workerProductivityPerDay, item.work).toBeGreaterThan(0);
      expect(item.details?.materialConsumptionFormula, item.work).toBeTruthy();
      expect(item.details?.qualityChecklist.length, item.work).toBeGreaterThan(0);
      expect(item.details?.rateHistory.length, item.work).toBeGreaterThan(0);
    }
  });

  test("adjusts rate by city, contract type and area premium", () => {
    expect(adjustedRate(100, { city: pune, contractType: "Residential", areaPremiumPercent: 0 })).toBe(100);
    expect(adjustedRate(100, { city: mumbai, contractType: "Commercial", areaPremiumPercent: 10 })).toBe(140);
  });

  test("calculates 4x8 bathroom tiling with wall and floor quantities", () => {
    const result = calculateBathroomTiles({
      lengthFt: 4,
      widthFt: 8,
      wallHeightFt: 7,
      tileSize: "2x4",
      includeFloor: true,
      includeWalls: true,
      wastagePercent: 10,
      boxCoverageSqft: 16,
      selectedRate: 180,
      labourOnlyRate: 45,
      materialOnlyRate: 135,
      marginPercent: 20,
      gstPercent: 18
    });

    expect(result.wallArea).toBe(168);
    expect(result.floorArea).toBe(32);
    expect(result.areaWithWastage).toBe(221);
    expect(result.tileQuantity).toBe(28);
    expect(result.tileBoxes).toBe(14);
    expect(result.sellingPrice).toBeGreaterThan(45000);
  });

  test("infers quantity from natural search before opening the calculator", () => {
    const tile = searchRateDatabase("4 by 8 bathroom complete tiling cost", 1)[0]!;
    const plaster = searchRateDatabase("500 sqft plaster", 1)[0]!;
    const acPoint = searchRateDatabase("AC point with 50 metre wiring", 1)[0]!;

    const bathroom = inferQuantityFromText({ text: "4 by 8 bathroom complete tiling cost", item: tile });
    const plasterArea = inferQuantityFromText({ text: "500 sqft plaster", item: plaster });
    const pointCount = inferQuantityFromText({ text: "AC point with 50 metre wiring", item: acPoint });

    expect(tile.work).toContain("Complete Bathroom");
    expect(bathroom.method).toBe("bathroom-area");
    expect(bathroom.quantity).toBe(220);
    expect(plasterArea.method).toBe("explicit-area");
    expect(plasterArea.quantity).toBe(500);
    expect(pointCount.method).toBe("default");
    expect(pointCount.quantity).toBe(1);
  });

  test("does not confuse 2x4 tile size with bathroom measurement", () => {
    const tile = searchRateDatabase("2x4 bathroom wall tile 4 by 8 bathroom", 1)[0]!;
    const bathroom = inferQuantityFromText({ text: "2x4 bathroom wall tile 4 by 8 bathroom", item: tile });
    const onlyTileSize = inferQuantityFromText({ text: "2x4 bathroom wall tile", item: tile });

    expect(tile.work).toContain("Bathroom");
    expect(bathroom.method).toBe("bathroom-area");
    expect(bathroom.lengthFt).toBe(4);
    expect(bathroom.widthFt).toBe(8);
    expect(bathroom.quantity).toBe(220);
    expect(bathroom.note).toContain("Tile size 2x4");
    expect(onlyTileSize.method).toBe("default");
    expect(onlyTileSize.note).toContain("Only tile size 2x4");
  });

  test("calculates room wall area for painting from room size and height", () => {
    const paint = searchRateDatabase("10x12 room painting full system height 9", 1)[0]!;
    const area = inferQuantityFromText({ text: "10x12 room painting full system height 9", item: paint });

    expect(paint.work).toContain("Painting");
    expect(area.method).toBe("room-wall-area");
    expect(area.quantity).toBe(396);
    expect(area.heightFt).toBe(9);
  });

  test("calculates labour per unit and selling price", () => {
    const result = calculateLabour({
      masons: 2,
      masonWage: 1000,
      helpers: 2,
      helperWage: 700,
      days: 3,
      workingHours: 8,
      outputQuantity: 600,
      marginPercent: 15
    });

    expect(result.totalLabourCost).toBe(10200);
    expect(result.perUnitCost).toBe(17);
    expect(result.sellingPrice).toBe(11730);
  });

  test("estimates core material quantities", () => {
    expect(calculateMaterials({ workType: "plaster", areaSqft: 500, thicknessMm: 12 }).cementBags).toBe(8);
    expect(calculateMaterials({ workType: "pop", areaSqft: 500, thicknessMm: 12 }).popBags).toBe(7);
    expect(calculateMaterials({ workType: "waterproofing", areaSqft: 500, thicknessMm: 12 }).waterproofChemicalLitres).toBe(15);
  });

  test("calculates electrical quote from points without multiplying totals twice", () => {
    const result = calculateElectrical({
      lightPoints: 10,
      fanPoints: 2,
      plugPoints: 4,
      power16aPoints: 2,
      acPoints: 1,
      geyserPoints: 1,
      ledStripRft: 20,
      marginPercent: 20
    });

    expect(result.pointCount).toBe(20);
    expect(result.wireLengthFt).toBeGreaterThan(600);
    expect(result.sellingPrice).toBeLessThan(50000);
  });

  test("builds BOQ rows and exportable csv", () => {
    const rows = [
      toBoqRow({ description: "Wall Tile", unit: "sqft", quantity: 100, rate: 180, gstPercent: 18 }),
      toBoqRow({ description: "POP Ceiling", unit: "sqft", quantity: 50, rate: 105, gstPercent: 18 })
    ];
    const totals = boqTotals(rows);
    const csv = rowsToCsv(rows);

    expect(totals.amount).toBe(23250);
    expect(totals.total).toBe(27435);
    expect(csv).toContain("Wall Tile");
  });

  test("creates an itemized work estimate with charges and quote levels", () => {
    const item = searchRateDatabase("bathroom waterproofing labour only", 1)[0]!;
    const estimate = calculateDetailedWorkEstimate({
      item,
      context: { city: pune, contractType: "Residential", areaPremiumPercent: 0 },
      quantity: 120,
      mode: "labourOnly",
      includeHeightCharge: false,
      includeDifficultAccess: true,
      includeSmallQuantitySurcharge: true,
      gstPercent: 18
    });

    expect(estimate.itemizedLines.some((line) => line.label === "Labour")).toBeTruthy();
    expect(estimate.itemizedLines.some((line) => line.label === "Difficult access")).toBeTruthy();
    expect(estimate.materialCost).toBe(0);
    expect(estimate.sellingPrice).toBeGreaterThan(estimate.labourCost);
    expect(estimate.architectRate).toBeGreaterThan(estimate.builderRate);
  });

  test("smart rate AI creates exact bathroom tiling estimate from natural language", () => {
    const analysis = analyzeRatePrompt({
      text: "4 by 8 bathroom complete tiling cost with 2x4 wall tile",
      catalog: expandedRateCatalog,
      context: { city: pune, contractType: "Residential", areaPremiumPercent: 0 },
      gstPercent: 18,
      rateLevel: "standard"
    });

    expect(analysis.item?.work).toContain("Complete Bathroom");
    expect(analysis.quantity?.method).toBe("bathroom-area");
    expect(analysis.quantity?.quantity).toBe(220);
    expect(analysis.estimate?.sellingPrice).toBeGreaterThan(40000);
    expect(analysis.boqRow?.quantity).toBe(220);
    expect(analysis.customerSummary).toContain("estimate");
    expect(analysis.precision.score).toBeGreaterThan(55);
    expect(analysis.ratePlans.map((plan) => plan.label)).toContain("Standard L+M");
    expect(analysis.assumptions.some((entry) => entry.label === "Measurement")).toBeTruthy();
    expect(analysis.formulaLines.some((line) => line.includes("Calculated bathroom tile area"))).toBeTruthy();
    expect(analysis.customerExplanation.customerSpecification).toContain("Complete Bathroom");
    expect(analysis.customerExplanation.included.length).toBeGreaterThan(3);
    expect(analysis.customerExplanation.confirmBeforeFinal.some((item) => item.includes("Tile brand"))).toBeTruthy();
    expect(analysis.customerExplanation.logicChecks.some((check) => check.label === "Customer total" && check.status === "ok")).toBeTruthy();
    expect(analysisToWhatsAppMessage(analysis)).toContain("Specification:");
    expect(analysis.pricingStrategy?.recommendedTotal).toBeGreaterThan(analysis.pricingStrategy?.negotiationFloor ?? 0);
    expect(analysis.pricingStrategy?.riskLevel).toBe("medium");
    expect(analysis.confidenceReasons.some((reason) => reason.includes("Quantity detected"))).toBeTruthy();
    expect(analysis.confidence).toBeGreaterThan(0.55);
  });

  test("smart rate AI respects labour-only prompts and excludes material cost", () => {
    const analysis = analyzeRatePrompt({
      text: "labour only 500 sqft internal plaster rate",
      catalog: expandedRateCatalog,
      context: { city: pune, contractType: "Residential", areaPremiumPercent: 0 },
      gstPercent: 18,
      rateLevel: "standard"
    });

    expect(analysis.quoteMode).toBe("labourOnly");
    expect(analysis.quantity?.quantity).toBe(500);
    expect(analysis.estimate?.materialCost).toBe(0);
    expect(analysis.estimate?.labourCost).toBeGreaterThan(0);
    expect(analysis.pricingStrategy?.profitMarginPercent).toBeGreaterThan(0);
    expect(analysis.warnings.some((warning) => warning.includes("Material purchase"))).toBeTruthy();
  });

  test("smart rate AI reports missing fields before final waterproofing quote", () => {
    const analysis = analyzeRatePrompt({
      text: "waterproofing cost",
      catalog: expandedRateCatalog,
      context: { city: pune, contractType: "Residential", areaPremiumPercent: 0 },
      gstPercent: 18,
      rateLevel: "standard"
    });

    expect(analysis.item?.work.toLowerCase()).toContain("waterproof");
    expect(analysis.quantity?.method).toBe("default");
    expect(analysis.missingFields).toContain("Exact measurement or quantity");
    expect(analysis.missingFields).toContain("Waterproofing location");
    expect(analysis.pricingStrategy?.riskLevel).toBe("high");
    expect(analysis.confidence).toBeLessThan(0.7);
  });

  test("builds a rate analyzer dashboard summary from saved rates and BOQ rows", () => {
    const rows = [toBoqRow({ description: "Bathroom waterproofing", unit: "sqft", quantity: 120, rate: 155, gstPercent: 18 })];
    const summary = buildRateAnalyzerSummary({
      catalog: expandedRateCatalog,
      customRateCount: 2,
      boqRows: rows,
      cityName: "Pune",
      lastBackupIso: "2026-07-21T10:00:00+05:30"
    });

    expect(summary.cards.find((card) => card.label === "Total saved rates")?.value).toBe(String(expandedRateCatalog.length));
    expect(summary.cards.find((card) => card.label === "Quotations from analyzer")?.detail).toContain("saved BOQ value");
    expect(summary.topCategories.length).toBeGreaterThan(0);
    expect(summary.averageContractorMarginPercent).toBeGreaterThan(0);
  });

  test("protects profit with site-condition multipliers and customer-safe floor", () => {
    const item = searchRateDatabase("4 by 8 bathroom complete tiling cost", 1)[0]!;
    const estimate = calculateDetailedWorkEstimate({
      item,
      context: { city: pune, contractType: "Residential", areaPremiumPercent: 0 },
      quantity: 220,
      mode: "labourMaterial",
      includeHeightCharge: false,
      includeDifficultAccess: false,
      includeSmallQuantitySurcharge: false,
      gstPercent: 18
    });
    const protection = analyzeProfitProtection({
      item,
      estimate,
      quantity: 220,
      quoteMode: "labourMaterial",
      context: { city: pune, contractType: "Residential", areaPremiumPercent: 0 },
      gstPercent: 18,
      selectedConditionKeys: ["liftUnavailable", "renovation"]
    });
    const brief = buildCustomerRateBrief({
      item,
      estimate,
      protection,
      quantity: 220,
      quoteMode: "labourMaterial"
    });

    expect(protection.recommendedTotal).toBeGreaterThanOrEqual(protection.safeFloor);
    expect(protection.conditionImpactTotal).toBeGreaterThan(0);
    expect(protection.comparisonPlans.map((plan) => plan.label)).toEqual(["Economy", "Standard", "Premium"]);
    expect(protection.transparencyLines.some((line) => line.includes("Direct cost"))).toBeTruthy();
    expect(brief.oneLineAnswer).toContain("customer");
    expect(brief.hinglishOneLineAnswer).toContain("customer amount");
    expect(brief.hinglishTalkingPoints.some((line) => line.includes("neeche mat jana"))).toBeTruthy();
    expect(brief.customerExclusions.length).toBeGreaterThan(0);
  });
});
