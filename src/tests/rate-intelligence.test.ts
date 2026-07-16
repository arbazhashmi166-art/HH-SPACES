import { describe, expect, test } from "vitest";
import {
  adjustedRate,
  boqTotals,
  calculateBathroomTiles,
  calculateElectrical,
  calculateLabour,
  calculateMaterials,
  rowsToCsv,
  toBoqRow
} from "@/features/rates/rate-calculator";
import { cityRateProfiles } from "@/features/rates/rate-catalog";

const pune = cityRateProfiles.find((city) => city.city === "Pune")!;
const mumbai = cityRateProfiles.find((city) => city.city === "Mumbai")!;

describe("rate intelligence calculations", () => {
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
});
