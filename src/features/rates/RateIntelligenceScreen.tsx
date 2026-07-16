"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatMoney } from "@/utils/format";
import {
  calculateBathroomTiles,
  calculateCarpentry,
  calculateDetailedWorkEstimate,
  calculateElectrical,
  calculateLabour,
  calculateMaterials,
  calculateQuoteBreakdown,
  boqTotals,
  rateForItem,
  rowsToCsv,
  toBoqRow,
  type BathroomTileInput,
  type BoqRow,
  type MaterialCalculatorInput,
  type QuoteMode,
  type RateLevel
} from "./rate-calculator";
import {
  cityRateProfiles,
  rateCategories,
  rateSourceNotes,
  type RateItemDetails,
  type CityRateProfile,
  type ContractType,
  type RateCategory,
  type RateItem,
  type RateUnit
} from "./rate-catalog";
import { constructionRateStats, expandedRateCatalog, searchRateDatabase } from "./expanded-rate-database";
import styles from "./RateIntelligenceScreen.module.css";

const customRateStorageKey = "hhspaces.customRates.v1";
const boqStorageKey = "hhspaces.rateBoq.v1";

type BathroomFormState = Omit<BathroomTileInput, "selectedRate" | "labourOnlyRate" | "materialOnlyRate" | "marginPercent" | "gstPercent">;

const rateLevels: { key: RateLevel; label: string }[] = [
  { key: "lowest", label: "Lowest" },
  { key: "standard", label: "Standard" },
  { key: "premium", label: "Premium" },
  { key: "luxury", label: "Luxury" },
  { key: "contractor", label: "Contractor" },
  { key: "architect", label: "Architect" },
  { key: "builder", label: "Builder" },
  { key: "labourOnly", label: "Labour" },
  { key: "materialOnly", label: "Material" },
  { key: "labourMaterial", label: "L+M" }
];

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function downloadFile(filename: string, contents: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function rateSearchText(item: RateItem) {
  return [item.work, item.category, item.subcategory, item.specification, item.unit, ...item.aliases, ...item.scope, item.details?.detailedSpecification, item.details?.materialConsumptionFormula, ...(item.details?.commonMistakes || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function moneyRange(item: RateItem, city: CityRateProfile, contractType: ContractType, areaPremiumPercent: number) {
  const context = { city, contractType, areaPremiumPercent };
  return `${formatMoney(rateForItem(item, "lowest", context))} - ${formatMoney(rateForItem(item, "luxury", context))}`;
}

function buildCustomRate(input: {
  category: RateCategory;
  work: string;
  unit: RateUnit;
  labourOnly: number;
  materialOnly: number;
  standard: number;
}): RateItem {
  const standard = Math.max(input.standard, input.labourOnly + input.materialOnly);
  const details = buildCustomRateDetails(input, standard);
  return {
    id: `custom-${Date.now()}`,
    category: input.category,
    work: input.work.trim(),
    unit: input.unit,
    aliases: [input.work.toLowerCase()],
    rates: {
      lowest: Math.round(standard * 0.82),
      standard,
      premium: Math.round(standard * 1.22),
      luxury: Math.round(standard * 1.55),
      contractor: Math.round(standard * 1.08),
      architect: Math.round(standard * 1.35),
      builder: Math.round(standard * 0.95),
      labourOnly: input.labourOnly,
      materialOnly: input.materialOnly,
      labourMaterial: standard
    },
    scope: ["Custom rate saved on this device"],
    subcategory: "Custom Rate",
    specification: `${input.work.trim()} custom rate`,
    details
  };
}

function buildCustomRateDetails(input: { category: RateCategory; work: string; unit: RateUnit; labourOnly: number; materialOnly: number }, standard: number): RateItemDetails {
  const labour = { low: Math.round(input.labourOnly * 0.82), standard: input.labourOnly, premium: Math.round(input.labourOnly * 1.22) };
  const material = { low: Math.round(input.materialOnly * 0.82), standard: input.materialOnly, premium: Math.round(input.materialOnly * 1.22) };
  const complete = { low: Math.round(standard * 0.82), standard, premium: Math.round(standard * 1.22) };
  return {
    subcategory: "Custom Rate",
    detailedSpecification: `${input.work.trim()} custom saved rate.`,
    commonAlternativeNames: [input.work.toLowerCase()],
    measurementFormula: "Measured actual finished quantity",
    minimumCharge: Math.max(standard, standard * 10),
    labourOnly: labour,
    materialOnly: material,
    labourPlusMaterial: complete,
    subcontractorRate: Math.round(standard * 0.86),
    contractorCostRate: Math.round(standard * 0.78),
    recommendedCustomerRate: Math.round(standard * 1.18),
    architectQuotationRate: Math.round(standard * 1.35),
    builderQuotationRate: Math.round(standard * 0.95),
    luxuryProjectRate: Math.round(standard * 1.58),
    workerProductivityPerDay: 100,
    skilledWorkersRequired: 1,
    helpersRequired: 1,
    machineRequired: "As required",
    materialConsumptionFormula: "Use custom material consumption from site measurement",
    materialWastagePercentage: 8,
    transportCost: Math.round(standard * 0.03),
    loadingUnloadingCost: Math.round(standard * 0.025),
    heightCharge: Math.round(standard * 0.12),
    smallQuantitySurcharge: Math.round(standard * 0.15),
    difficultAccessSurcharge: Math.round(standard * 0.18),
    demolitionCost: 0,
    debrisCost: 0,
    salvageValue: 0,
    supervisionPercentage: 4,
    contractorOverhead: 6,
    profitPercentage: 18,
    gst: 18,
    rateValidityDate: "2026-07-16",
    city: "Pune",
    areaOrLocality: "Custom",
    brand: "As selected",
    qualityGrade: "Custom",
    notes: "Custom rate stored on this device.",
    exclusions: ["Hidden repair", "Premium brand upgrade", "Night work"],
    warranty: "As per final quotation",
    workSequence: ["Measure", "Approve rate", "Execute", "Quality check"],
    qualityChecklist: ["Measurement checked", "Rate approved", "Finish checked"],
    commonMistakes: ["Not updating rate after supplier price change", "Ignoring wastage"],
    requiredTools: ["As required"],
    completionTime: "Depends on quantity",
    beforeWorkPhotographs: ["Existing condition"],
    afterWorkPhotographs: ["Completed work"],
    rateHistory: [{ date: "2026-07-16", city: "Pune", standardRate: standard, source: "custom" }]
  };
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={styles.sectionTitle}>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
  min = "0"
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
  min?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input min={min} step={step} type="number" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(numberValue(event.target.value))} />
    </label>
  );
}

export function RateIntelligenceScreen() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RateCategory>("Tiling");
  const [city, setCity] = useState<CityRateProfile>(cityRateProfiles[0] ?? { state: "Maharashtra", city: "Pune", multiplier: 1, note: "Base profile" });
  const [contractType, setContractType] = useState<ContractType>("Residential");
  const [areaPremiumPercent, setAreaPremiumPercent] = useState(0);
  const [rateLevel, setRateLevel] = useState<RateLevel>("standard");
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("labourMaterial");
  const [quantity, setQuantity] = useState(100);
  const [marginPercent, setMarginPercent] = useState(18);
  const [overheadPercent, setOverheadPercent] = useState(3);
  const [gstPercent, setGstPercent] = useState(18);
  const [selectedItemId, setSelectedItemId] = useState("tile-wall-2x4");
  const [customRates, setCustomRates] = useState<RateItem[]>([]);
  const [boqRows, setBoqRows] = useState<BoqRow[]>([]);
  const [notice, setNotice] = useState("");
  const [assistantText, setAssistantText] = useState("Cost of 4x8 bathroom tiling with 2x4 wall tile");
  const [assistantResult, setAssistantResult] = useState("");
  const [assistantRow, setAssistantRow] = useState<BoqRow | null>(null);
  const [importText, setImportText] = useState("");
  const [customDraft, setCustomDraft] = useState({
    category: "Tiling" as RateCategory,
    work: "",
    unit: "sqft" as RateUnit,
    labourOnly: 40,
    materialOnly: 120,
    standard: 180
  });

  const [bathroom, setBathroom] = useState<BathroomFormState>({
    lengthFt: 4,
    widthFt: 8,
    wallHeightFt: 7,
    tileSize: "2x4" as const,
    includeFloor: true,
    includeWalls: true,
    wastagePercent: 10,
    boxCoverageSqft: 16
  });

  const [labourCalc, setLabourCalc] = useState({
    masons: 2,
    masonWage: 1000,
    helpers: 2,
    helperWage: 700,
    days: 1,
    workingHours: 8,
    outputQuantity: 250,
    marginPercent: 18
  });

  const [materialCalc, setMaterialCalc] = useState<MaterialCalculatorInput>({
    workType: "plaster" as const,
    areaSqft: 500,
    thicknessMm: 12
  });

  const [electricalCalc, setElectricalCalc] = useState({
    lightPoints: 12,
    fanPoints: 4,
    plugPoints: 10,
    power16aPoints: 4,
    acPoints: 2,
    geyserPoints: 2,
    ledStripRft: 60,
    marginPercent: 20
  });

  const [carpenterCalc, setCarpenterCalc] = useState({
    workAreaSqft: 100,
    labourRate: 350,
    materialRate: 1250,
    hardwarePercent: 12,
    marginPercent: 22
  });

  useEffect(() => {
    setCustomRates(loadJson<RateItem[]>(customRateStorageKey, []));
    setBoqRows(loadJson<BoqRow[]>(boqStorageKey, []));
  }, []);

  useEffect(() => {
    saveJson(customRateStorageKey, customRates);
  }, [customRates]);

  useEffect(() => {
    saveJson(boqStorageKey, boqRows);
  }, [boqRows]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const catalog = useMemo(() => [...expandedRateCatalog, ...customRates], [customRates]);

  const context = useMemo(() => ({ city, contractType, areaPremiumPercent }), [areaPremiumPercent, city, contractType]);

  const filteredRates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = query.trim()
      ? [
          ...searchRateDatabase(query, 500).filter((item) => catalog.some((catalogItem) => catalogItem.id === item.id)),
          ...customRates.filter((item) => rateSearchText(item).includes(normalized))
        ]
      : catalog;
    const scoped = source.filter((item) => (normalized ? true : item.category === category));
    return normalized ? scoped : scoped.sort((a, b) => rateForItem(b, rateLevel, context) - rateForItem(a, rateLevel, context));
  }, [catalog, category, context, customRates, query, rateLevel]);

  const selectedItem = catalog.find((item) => item.id === selectedItemId) ?? filteredRates[0] ?? catalog[0];
  const tileItem = catalog.find((item) => item.id === "tile-wall-2x4") ?? selectedItem;
  const selectedRate = selectedItem ? rateForItem(selectedItem, rateLevel, context) : 0;
  const labourRate = selectedItem ? rateForItem(selectedItem, "labourOnly", context) : 0;
  const materialRate = selectedItem ? rateForItem(selectedItem, "materialOnly", context) : 0;
  const detailedEstimate = selectedItem
    ? calculateDetailedWorkEstimate({
        item: selectedItem,
        context,
        quantity,
        mode: quoteMode,
        includeHeightCharge: false,
        includeDifficultAccess: false,
        includeSmallQuantitySurcharge: true,
        gstPercent
      })
    : null;
  const quote = calculateQuoteBreakdown({
    quantity,
    labourRate,
    materialRate,
    mode: quoteMode,
    overheadPercent,
    marginPercent,
    gstPercent
  });

  const bathroomResult = tileItem
    ? calculateBathroomTiles({
        ...bathroom,
        selectedRate: rateForItem(tileItem, rateLevel, context),
        labourOnlyRate: rateForItem(tileItem, "labourOnly", context),
        materialOnlyRate: rateForItem(tileItem, "materialOnly", context),
        marginPercent,
        gstPercent
      })
    : null;

  const labourResult = calculateLabour(labourCalc);
  const materialResult = calculateMaterials(materialCalc);
  const electricalResult = calculateElectrical(electricalCalc);
  const carpenterResult = calculateCarpentry(carpenterCalc);
  const totals = boqTotals(boqRows);

  function addSelectedToBoq() {
    if (!selectedItem) return;
    const row = toBoqRow({
      description: selectedItem.work,
      unit: selectedItem.unit,
      quantity,
      rate: selectedRate,
      gstPercent
    });
    setBoqRows((current) => [row, ...current]);
    setNotice("Added to BOQ");
  }

  function addBathroomToBoq() {
    if (!bathroomResult || !tileItem) return;
    const row = toBoqRow({
      description: `${tileItem.work} - ${bathroom.lengthFt}x${bathroom.widthFt} bathroom`,
      unit: "sqft",
      quantity: bathroomResult.areaWithWastage,
      rate: bathroomResult.perUnitSelling,
      gstPercent
    });
    setBoqRows((current) => [row, ...current]);
    setNotice("Bathroom estimate added to BOQ");
  }

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setNotice("Copy failed. Select and copy manually.");
    }
  }

  function exportBoq() {
    if (!boqRows.length) {
      setNotice("Add at least one BOQ item first");
      return;
    }
    downloadFile(`hh-spaces-boq-${Date.now()}.csv`, rowsToCsv(boqRows));
  }

  function exportRateDatabase() {
    const header = "Category,Work,Unit,Lowest,Standard,Premium,Luxury,Contractor,Architect,Builder,Labour Only,Material Only,Labour + Material\n";
    const body = catalog
      .map((item) =>
        [
          item.category,
          item.work,
          item.unit,
          item.rates.lowest,
          item.rates.standard,
          item.rates.premium,
          item.rates.luxury,
          item.rates.contractor,
          item.rates.architect,
          item.rates.builder,
          item.rates.labourOnly,
          item.rates.materialOnly,
          item.rates.labourMaterial
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    downloadFile(`hh-spaces-rate-database-${Date.now()}.csv`, header + body);
  }

  function importRates() {
    const rows = importText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const imported = rows
      .map((line) => {
        const [categoryValue, work, unitValue, standardValue, labourValue, materialValue] = line.split(",").map((part) => part.trim());
        const foundCategory = rateCategories.find((entry) => entry.toLowerCase() === categoryValue?.toLowerCase());
        if (!foundCategory || !work) return null;
        return buildCustomRate({
          category: foundCategory,
          work,
          unit: (unitValue || "sqft") as RateUnit,
          standard: numberValue(standardValue || "0"),
          labourOnly: numberValue(labourValue || "0"),
          materialOnly: numberValue(materialValue || "0")
        });
      })
      .filter((item): item is RateItem => Boolean(item));

    if (!imported.length) {
      setNotice("No valid CSV rows found");
      return;
    }
    setCustomRates((current) => [...imported, ...current]);
    setImportText("");
    setNotice(`${imported.length} custom rates imported`);
  }

  function addCustomRate() {
    if (!customDraft.work.trim()) {
      setNotice("Enter custom work name");
      return;
    }
    setCustomRates((current) => [buildCustomRate(customDraft), ...current]);
    setCustomDraft((current) => ({ ...current, work: "" }));
    setNotice("Custom rate saved");
  }

  function runAssistant() {
    const text = assistantText.toLowerCase();
    const dimensions = text.match(/(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)/);
    const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(sqft|sq ft|square feet|square)/);
    const first = dimensions ? numberValue(dimensions[1] ?? "0") : 0;
    const second = dimensions ? numberValue(dimensions[2] ?? "0") : 0;
    const inferredPackageArea = text.includes("3bhk") ? 950 : text.includes("2bhk") ? 650 : 0;
    const area = areaMatch ? numberValue(areaMatch[1] ?? "0") : first * second || inferredPackageArea;

    if ((text.includes("tile") || text.includes("bathroom")) && dimensions && tileItem) {
      const result = calculateBathroomTiles({
        ...bathroom,
        lengthFt: first,
        widthFt: second,
        selectedRate: rateForItem(tileItem, rateLevel, context),
        labourOnlyRate: rateForItem(tileItem, "labourOnly", context),
        materialOnlyRate: rateForItem(tileItem, "materialOnly", context),
        marginPercent,
        gstPercent
      });
      const row = toBoqRow({
        description: `${tileItem.work} - ${first}x${second} bathroom`,
        unit: "sqft",
        quantity: result.areaWithWastage,
        rate: result.perUnitSelling,
        gstPercent
      });
      setAssistantRow(row);
      setAssistantResult(`Bathroom tile estimate: ${result.areaWithWastage} sqft including wastage, ${result.tileQuantity} tiles, ${result.tileBoxes} boxes, customer quote ${formatMoney(result.sellingPrice)}.`);
      return;
    }

    const naturalSearchTarget = searchRateDatabase(assistantText, 1)[0];
    const target =
      naturalSearchTarget ||
      (text.includes("pop") || text.includes("ceiling")
        ? catalog.find((item) => item.id === "pop-ceiling")
        : text.includes("waterproof")
          ? catalog.find((item) => (text.includes("bath") ? item.id === "waterproof-bathroom" : item.id === "waterproof-terrace"))
          : text.includes("plaster")
            ? catalog.find((item) => item.id === "plaster-internal")
            : text.includes("electrical") || text.includes("3bhk")
              ? catalog.find((item) => item.id === "electrical-light-point")
              : selectedItem);

    if (!target || !area) {
      setAssistantRow(null);
      setAssistantResult("I need a work type and size. Example: POP for 12x15 hall, waterproofing 500 sqft, or 4x8 bathroom tiling.");
      return;
    }

    const rate = rateForItem(target, rateLevel, context);
    const detail = calculateDetailedWorkEstimate({
      item: target,
      context,
      quantity: area,
      mode: "labourMaterial",
      includeHeightCharge: /height|external|facade|scaffold|rope/.test(text),
      includeDifficultAccess: /difficult|restricted|society|small|repair/.test(text),
      includeSmallQuantitySurcharge: area < Math.max(1, target.details?.workerProductivityPerDay || 100),
      gstPercent
    });
    const row = toBoqRow({
      description: target.work,
      unit: target.unit,
      quantity: area,
      rate: detail.perUnitSelling || rate,
      gstPercent
    });
    setAssistantRow(row);
    setAssistantResult(
      `${target.work}: ${area} ${target.unit}. Labour ${formatMoney(detail.labourCost)}, material ${formatMoney(detail.materialCost)}, overhead ${formatMoney(detail.overheadCost)}, profit ${formatMoney(detail.profitCost)}, GST ${formatMoney(detail.gstCost)}. Customer estimate ${formatMoney(detail.sellingPrice)}.`
    );
  }

  const customerMessage = [
    "H&H SPACES Quotation Estimate",
    selectedItem ? `Work: ${selectedItem.work}` : "",
    `Qty: ${quantity} ${selectedItem?.unit || "unit"}`,
    `Rate: ${formatMoney(selectedRate)} / ${selectedItem?.unit || "unit"}`,
    `Estimated total: ${formatMoney(quote.sellingPrice)}`,
    "Final amount can change after site measurement, design, material brand and surface condition."
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section className={styles.stack}>
      {notice ? <div className={styles.toast}>{notice}</div> : null}

      <div className={styles.hero}>
        <div>
          <span>Construction Pricing Engine</span>
          <h1>Rate Intelligence</h1>
          <p>Search rates, compare labour/material prices, calculate BOQ, and quote customers instantly.</p>
        </div>
        <div className={styles.heroMetric}>
          <strong>{constructionRateStats.itemCount + customRates.length}</strong>
          <span>rate items</span>
        </div>
      </div>

      <Card>
        <CardHeader title="Market Adjustment" subtitle="Use Pune as the base. Change city and contract type before telling a customer." />
        <div className={styles.grid3}>
          <label className={styles.field}>
            <span>City</span>
            <select value={city.city} onChange={(event) => setCity(cityRateProfiles.find((entry) => entry.city === event.target.value) ?? cityRateProfiles[0]!)}>
              {cityRateProfiles.map((entry) => (
                <option key={entry.city} value={entry.city}>
                  {entry.city}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Contract Type</span>
            <select value={contractType} onChange={(event) => setContractType(event.target.value as ContractType)}>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
              <option value="Industrial">Industrial</option>
              <option value="Luxury">Luxury</option>
            </select>
          </label>
          <NumberField label="Area Premium %" value={areaPremiumPercent} min="-30" onChange={setAreaPremiumPercent} />
        </div>
        <p className={styles.helperText}>{city.note}</p>
      </Card>

      <SectionTitle title="Instant Search" subtitle="Find any work: POP, 2x4 tile, waterproofing, electrician point, carpenter, plaster." />
      <div className={styles.searchBar}>
        <input aria-label="Search rates" placeholder="Search any work rate" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Sort rate level" value={rateLevel} onChange={(event) => setRateLevel(event.target.value as RateLevel)}>
          {rateLevels.map((level) => (
            <option key={level.key} value={level.key}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.categoryRail} aria-label="Rate categories">
        {rateCategories.map((item) => (
          <button className={item === category ? styles.activeChip : styles.chip} key={item} type="button" onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className={styles.rateList}>
        {filteredRates.slice(0, 18).map((item) => {
          const active = item.id === selectedItem?.id;
          return (
            <button
              className={active ? styles.rateCardActive : styles.rateCard}
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedItemId(item.id);
                setQuantity(item.unit === "point" || item.unit === "nos" ? 1 : 100);
              }}
            >
              <span className={styles.rateCardTop}>
                <strong>{item.work}</strong>
                <Badge tone={active ? "success" : "neutral"}>{item.unit}</Badge>
              </span>
              <span>{moneyRange(item, city, contractType, areaPremiumPercent)}</span>
              <span className={styles.subcategory}>{item.details?.subcategory || item.subcategory}</span>
              <span className={styles.miniMatrix}>
                Labour {formatMoney(rateForItem(item, "labourOnly", context))} · Material {formatMoney(rateForItem(item, "materialOnly", context))} · L+M {formatMoney(rateForItem(item, "labourMaterial", context))}
              </span>
            </button>
          );
        })}
      </div>

      {selectedItem ? (
        <Card>
          <CardHeader title={selectedItem.work} subtitle={`${selectedItem.category} · ${city.city} · ${contractType}`} action={<Badge tone="info">{selectedItem.unit}</Badge>} />
          <div className={styles.matrixGrid}>
            {rateLevels.map((level) => (
              <div className={styles.rateBox} key={level.key}>
                <span>{level.label}</span>
                <strong>{formatMoney(rateForItem(selectedItem, level.key, context))}</strong>
              </div>
            ))}
          </div>
          <div className={styles.scopeList}>
            {selectedItem.scope.map((scope) => (
              <span key={scope}>{scope}</span>
            ))}
          </div>
          {selectedItem.caution ? <p className={styles.warningText}>{selectedItem.caution}</p> : null}
          {selectedItem.details ? (
            <div className={styles.detailGrid}>
              <div>
                <span>Measurement</span>
                <strong>{selectedItem.details.measurementFormula}</strong>
              </div>
              <div>
                <span>Productivity</span>
                <strong>
                  {selectedItem.details.workerProductivityPerDay} {selectedItem.unit}/day
                </strong>
              </div>
              <div>
                <span>Team</span>
                <strong>
                  {selectedItem.details.skilledWorkersRequired} skilled · {selectedItem.details.helpersRequired} helper
                </strong>
              </div>
              <div>
                <span>Material Formula</span>
                <strong>{selectedItem.details.materialConsumptionFormula}</strong>
              </div>
              <div>
                <span>Minimum Charge</span>
                <strong>{formatMoney(selectedItem.details.minimumCharge)}</strong>
              </div>
              <div>
                <span>Warranty</span>
                <strong>{selectedItem.details.warranty}</strong>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Quick Customer Quote" subtitle="Labour only, material only, or complete labour + material quotation." />
        <div className={styles.grid3}>
          <NumberField label={`Quantity (${selectedItem?.unit || "unit"})`} value={quantity} onChange={setQuantity} />
          <label className={styles.field}>
            <span>Quote Mode</span>
            <select value={quoteMode} onChange={(event) => setQuoteMode(event.target.value as QuoteMode)}>
              <option value="labourMaterial">Labour + Material</option>
              <option value="labourOnly">Labour Only</option>
              <option value="materialOnly">Material Only</option>
            </select>
          </label>
          <NumberField label="Profit %" value={marginPercent} onChange={setMarginPercent} />
          <NumberField label="Overhead %" value={overheadPercent} onChange={setOverheadPercent} />
          <NumberField label="GST %" value={gstPercent} onChange={setGstPercent} />
        </div>
        <div className={styles.resultGrid}>
          <div>
            <span>Labour</span>
            <strong>{formatMoney(quote.labourCost)}</strong>
          </div>
          <div>
            <span>Material</span>
            <strong>{formatMoney(quote.materialCost)}</strong>
          </div>
          <div>
            <span>Profit</span>
            <strong>{formatMoney(quote.profitCost)}</strong>
          </div>
          <div>
            <span>Customer Quote</span>
            <strong>{formatMoney(quote.sellingPrice)}</strong>
          </div>
        </div>
        {detailedEstimate ? (
          <div className={styles.itemizedPanel}>
            <div className={styles.itemizedHeader}>
              <div>
                <strong>Itemized Analyzer</strong>
                <span>
                  {detailedEstimate.productivityDays} working day estimate · contractor cost {formatMoney(detailedEstimate.contractorCost)}
                </span>
              </div>
              <Badge tone="info">{formatMoney(detailedEstimate.perUnitSelling)} / {selectedItem?.unit}</Badge>
            </div>
            <div className={styles.itemizedLines}>
              {detailedEstimate.itemizedLines.map((line) => (
                <div key={line.label}>
                  <span>{line.label}</span>
                  <strong>{formatMoney(line.amount)}</strong>
                </div>
              ))}
            </div>
            <div className={styles.quoteLevels}>
              <span>Builder {formatMoney(detailedEstimate.builderRate)}</span>
              <span>Customer {formatMoney(detailedEstimate.customerRate)}</span>
              <span>Architect {formatMoney(detailedEstimate.architectRate)}</span>
            </div>
          </div>
        ) : null}
        <div className={styles.actionRow}>
          <Button onClick={addSelectedToBoq}>Add To BOQ</Button>
          <Button variant="secondary" onClick={() => void copyText(customerMessage, "Quote copied for WhatsApp")}>
            Copy Quote
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Bathroom Tile Calculator" subtitle="Use for 2x4 bathroom tiling, wall/floor area, tile boxes, adhesive, grout and total quote." />
        <div className={styles.grid3}>
          <NumberField label="Bathroom Length ft" value={bathroom.lengthFt} onChange={(value) => setBathroom((current) => ({ ...current, lengthFt: value }))} />
          <NumberField label="Bathroom Width ft" value={bathroom.widthFt} onChange={(value) => setBathroom((current) => ({ ...current, widthFt: value }))} />
          <NumberField label="Tile Height ft" value={bathroom.wallHeightFt} onChange={(value) => setBathroom((current) => ({ ...current, wallHeightFt: value }))} />
          <label className={styles.field}>
            <span>Tile Size</span>
            <select value={bathroom.tileSize} onChange={(event) => setBathroom((current) => ({ ...current, tileSize: event.target.value as "1x2" | "2x2" | "2x4" | "4x4" }))}>
              <option value="1x2">1x2</option>
              <option value="2x2">2x2</option>
              <option value="2x4">2x4</option>
              <option value="4x4">4x4</option>
            </select>
          </label>
          <NumberField label="Wastage %" value={bathroom.wastagePercent} onChange={(value) => setBathroom((current) => ({ ...current, wastagePercent: value }))} />
          <NumberField label="Box Coverage sqft" value={bathroom.boxCoverageSqft} onChange={(value) => setBathroom((current) => ({ ...current, boxCoverageSqft: value }))} />
        </div>
        <div className={styles.toggleRow}>
          <label>
            <input checked={bathroom.includeWalls} type="checkbox" onChange={(event) => setBathroom((current) => ({ ...current, includeWalls: event.target.checked }))} />
            Wall tiles
          </label>
          <label>
            <input checked={bathroom.includeFloor} type="checkbox" onChange={(event) => setBathroom((current) => ({ ...current, includeFloor: event.target.checked }))} />
            Floor tiles
          </label>
        </div>
        {bathroomResult ? (
          <>
            <div className={styles.resultGrid}>
              <div>
                <span>Wall Area</span>
                <strong>{bathroomResult.wallArea} sqft</strong>
              </div>
              <div>
                <span>Floor Area</span>
                <strong>{bathroomResult.floorArea} sqft</strong>
              </div>
              <div>
                <span>With Wastage</span>
                <strong>{bathroomResult.areaWithWastage} sqft</strong>
              </div>
              <div>
                <span>Tile Boxes</span>
                <strong>{bathroomResult.tileBoxes}</strong>
              </div>
              <div>
                <span>Adhesive</span>
                <strong>{bathroomResult.adhesiveBags} bags</strong>
              </div>
              <div>
                <span>Grout</span>
                <strong>{bathroomResult.groutKg} kg</strong>
              </div>
              <div>
                <span>Customer Quote</span>
                <strong>{formatMoney(bathroomResult.sellingPrice)}</strong>
              </div>
            </div>
            <div className={styles.actionRow}>
              <Button onClick={addBathroomToBoq}>Add Bathroom To BOQ</Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void copyText(
                    `Bathroom tile estimate\nSize: ${bathroom.lengthFt}x${bathroom.widthFt}\nArea: ${bathroomResult.areaWithWastage} sqft\nBoxes: ${bathroomResult.tileBoxes}\nQuote: ${formatMoney(bathroomResult.sellingPrice)}`,
                    "Bathroom estimate copied"
                  )
                }
              >
                Copy Bathroom Quote
              </Button>
            </div>
          </>
        ) : null}
      </Card>

      <SectionTitle title="Trade Calculators" subtitle="Quick labour, material, electrical and carpenter analyzers for daily estimating." />
      <div className={styles.calculatorGrid}>
        <Card>
          <CardHeader title="Labour Calculator" subtitle="Mason, helper, working days and per-sqft output." />
          <div className={styles.grid2}>
            <NumberField label="Masons" value={labourCalc.masons} onChange={(value) => setLabourCalc((current) => ({ ...current, masons: value }))} />
            <NumberField label="Mason Wage" value={labourCalc.masonWage} onChange={(value) => setLabourCalc((current) => ({ ...current, masonWage: value }))} />
            <NumberField label="Helpers" value={labourCalc.helpers} onChange={(value) => setLabourCalc((current) => ({ ...current, helpers: value }))} />
            <NumberField label="Helper Wage" value={labourCalc.helperWage} onChange={(value) => setLabourCalc((current) => ({ ...current, helperWage: value }))} />
            <NumberField label="Days" value={labourCalc.days} onChange={(value) => setLabourCalc((current) => ({ ...current, days: value }))} />
            <NumberField label="Output sqft/points" value={labourCalc.outputQuantity} onChange={(value) => setLabourCalc((current) => ({ ...current, outputQuantity: value }))} />
          </div>
          <div className={styles.compactResult}>
            <strong>{formatMoney(labourResult.sellingPrice)}</strong>
            <span>{formatMoney(labourResult.perUnitCost)} base cost per unit · profit {formatMoney(labourResult.profit)}</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Material Calculator" subtitle="Plaster, POP, RCC, paint and waterproofing consumption." />
          <div className={styles.grid2}>
            <label className={styles.field}>
              <span>Work Type</span>
              <select value={materialCalc.workType} onChange={(event) => setMaterialCalc((current) => ({ ...current, workType: event.target.value as "plaster" | "pop" | "waterproofing" | "rcc" | "paint" }))}>
                <option value="plaster">Plaster</option>
                <option value="pop">POP</option>
                <option value="waterproofing">Waterproofing</option>
                <option value="rcc">RCC</option>
                <option value="paint">Paint</option>
              </select>
            </label>
            <NumberField label="Area sqft" value={materialCalc.areaSqft} onChange={(value) => setMaterialCalc((current) => ({ ...current, areaSqft: value }))} />
            <NumberField label="Thickness mm" value={materialCalc.thicknessMm} onChange={(value) => setMaterialCalc((current) => ({ ...current, thicknessMm: value }))} />
          </div>
          <div className={styles.materialChips}>
            <span>Cement {materialResult.cementBags} bags</span>
            <span>Sand {materialResult.sandCft} cft</span>
            <span>Aggregate {materialResult.aggregateCft} cft</span>
            <span>POP {materialResult.popBags} bags</span>
            <span>Paint {materialResult.paintLitres} L</span>
            <span>Chemical {materialResult.waterproofChemicalLitres} L</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Electrical Calculator" subtitle="Points, wire length, conduit, labour and material quote." />
          <div className={styles.grid2}>
            <NumberField label="Light Points" value={electricalCalc.lightPoints} onChange={(value) => setElectricalCalc((current) => ({ ...current, lightPoints: value }))} />
            <NumberField label="Fan Points" value={electricalCalc.fanPoints} onChange={(value) => setElectricalCalc((current) => ({ ...current, fanPoints: value }))} />
            <NumberField label="Plug Points" value={electricalCalc.plugPoints} onChange={(value) => setElectricalCalc((current) => ({ ...current, plugPoints: value }))} />
            <NumberField label="16A Points" value={electricalCalc.power16aPoints} onChange={(value) => setElectricalCalc((current) => ({ ...current, power16aPoints: value }))} />
            <NumberField label="AC Points" value={electricalCalc.acPoints} onChange={(value) => setElectricalCalc((current) => ({ ...current, acPoints: value }))} />
            <NumberField label="LED Strip rft" value={electricalCalc.ledStripRft} onChange={(value) => setElectricalCalc((current) => ({ ...current, ledStripRft: value }))} />
          </div>
          <div className={styles.compactResult}>
            <strong>{formatMoney(electricalResult.sellingPrice)}</strong>
            <span>{electricalResult.wireLengthFt} ft wire · {electricalResult.conduitLengthFt} ft conduit · {electricalResult.pointCount} points</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Carpenter Calculator" subtitle="Wardrobe, TV unit, kitchen and furniture frontage rate." />
          <div className={styles.grid2}>
            <NumberField label="Work Area sqft" value={carpenterCalc.workAreaSqft} onChange={(value) => setCarpenterCalc((current) => ({ ...current, workAreaSqft: value }))} />
            <NumberField label="Labour Rate" value={carpenterCalc.labourRate} onChange={(value) => setCarpenterCalc((current) => ({ ...current, labourRate: value }))} />
            <NumberField label="Material Rate" value={carpenterCalc.materialRate} onChange={(value) => setCarpenterCalc((current) => ({ ...current, materialRate: value }))} />
            <NumberField label="Hardware %" value={carpenterCalc.hardwarePercent} onChange={(value) => setCarpenterCalc((current) => ({ ...current, hardwarePercent: value }))} />
          </div>
          <div className={styles.compactResult}>
            <strong>{formatMoney(carpenterResult.sellingPrice)}</strong>
            <span>{carpenterResult.plywoodSheets} plywood sheets · {carpenterResult.laminateSheets} laminate sheets · hardware {formatMoney(carpenterResult.hardwareCost)}</span>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Smart Estimate Assistant" subtitle="Type natural language and it will create an editable BOQ draft from the rate database." />
        <textarea className={styles.assistantInput} value={assistantText} onChange={(event) => setAssistantText(event.target.value)} />
        <div className={styles.actionRow}>
          <Button onClick={runAssistant}>Analyze Text</Button>
          {assistantRow ? (
            <Button
              variant="secondary"
              onClick={() => {
                setBoqRows((current) => [assistantRow, ...current]);
                setAssistantRow(null);
                setNotice("Assistant draft added to BOQ");
              }}
            >
              Add Draft To BOQ
            </Button>
          ) : null}
        </div>
        {assistantResult ? <p className={styles.assistantResult}>{assistantResult}</p> : null}
      </Card>

      <Card>
        <CardHeader title="Professional BOQ" subtitle="Rows are saved on this phone and can be exported for Excel, print, or WhatsApp." />
        <div className={styles.boqSummary}>
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(totals.amount)}</strong>
          </div>
          <div>
            <span>GST</span>
            <strong>{formatMoney(totals.gst)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>
        </div>
        <div className={styles.boqList}>
          {boqRows.length ? (
            boqRows.map((row, index) => (
              <div className={styles.boqRow} key={row.id}>
                <div>
                  <span>#{index + 1}</span>
                  <strong>{row.description}</strong>
                  <p>
                    {row.quantity} {row.unit} x {formatMoney(row.rate)} · GST {row.gstPercent}%
                  </p>
                </div>
                <div>
                  <strong>{formatMoney(row.total)}</strong>
                  <button type="button" onClick={() => setBoqRows((current) => current.filter((item) => item.id !== row.id))}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.emptyState}>No BOQ rows yet. Add a rate, bathroom estimate, or assistant draft.</p>
          )}
        </div>
        <div className={styles.actionRow}>
          <Button onClick={exportBoq}>Export CSV</Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void copyText(
                [`H&H SPACES BOQ`, ...boqRows.map((row, index) => `${index + 1}. ${row.description}: ${formatMoney(row.total)}`), `Total: ${formatMoney(totals.total)}`].join("\n"),
                "BOQ copied for WhatsApp"
              )
            }
          >
            Copy WhatsApp
          </Button>
          <Button variant="ghost" onClick={() => setBoqRows([])}>
            Clear BOQ
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Admin Rate Panel" subtitle="Add your own rates, import simple CSV, export the rate database, and keep your local market list ready." />
        <div className={styles.grid3}>
          <label className={styles.field}>
            <span>Category</span>
            <select value={customDraft.category} onChange={(event) => setCustomDraft((current) => ({ ...current, category: event.target.value as RateCategory }))}>
              {rateCategories.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Work Name</span>
            <input value={customDraft.work} onChange={(event) => setCustomDraft((current) => ({ ...current, work: event.target.value }))} placeholder="Example: Bathroom niche tile" />
          </label>
          <label className={styles.field}>
            <span>Unit</span>
            <select value={customDraft.unit} onChange={(event) => setCustomDraft((current) => ({ ...current, unit: event.target.value as RateUnit }))}>
              <option value="sqft">sqft</option>
              <option value="rft">rft</option>
              <option value="point">point</option>
              <option value="nos">nos</option>
              <option value="day">day</option>
              <option value="kg">kg</option>
            </select>
          </label>
          <NumberField label="Labour Rate" value={customDraft.labourOnly} onChange={(value) => setCustomDraft((current) => ({ ...current, labourOnly: value }))} />
          <NumberField label="Material Rate" value={customDraft.materialOnly} onChange={(value) => setCustomDraft((current) => ({ ...current, materialOnly: value }))} />
          <NumberField label="Standard L+M Rate" value={customDraft.standard} onChange={(value) => setCustomDraft((current) => ({ ...current, standard: value }))} />
        </div>
        <div className={styles.actionRow}>
          <Button onClick={addCustomRate}>Save Custom Rate</Button>
          <Button variant="secondary" onClick={exportRateDatabase}>
            Export Rate Database
          </Button>
        </div>
        <textarea className={styles.assistantInput} placeholder="Import CSV rows: Category,Work,Unit,Standard,Labour,Material" value={importText} onChange={(event) => setImportText(event.target.value)} />
        <div className={styles.actionRow}>
          <Button variant="secondary" onClick={importRates}>
            Import CSV Rows
          </Button>
          {customRates.length ? (
            <Button variant="danger" onClick={() => setCustomRates([])}>
              Delete Custom Rates
            </Button>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Market Notes" subtitle="Use these as planning ranges, then confirm before final quotation." />
        <div className={styles.noteList}>
          {rateSourceNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </Card>
    </section>
  );
}
