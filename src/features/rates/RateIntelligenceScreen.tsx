"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/utils/format";
import {
  calculateBathroomTiles,
  calculateCarpentry,
  calculateDetailedWorkEstimate,
  calculateElectrical,
  calculateLabour,
  calculateMaterials,
  calculateQuoteBreakdown,
  defaultQuantityForRateItem,
  inferQuantityFromText,
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
import { analysisToWhatsAppMessage, analyzeRatePrompt, type RateAiAnalysis } from "./rate-ai-engine";
import {
  analyzeProfitProtection,
  buildCustomerRateBrief,
  buildRateDecisionEngine,
  buildRateAnalyzerSummary,
  siteConditionMultipliers,
  type SiteConditionKey
} from "./rate-intelligence-engine";
import styles from "./RateIntelligenceScreen.module.css";

const customRateStorageKey = "hhspaces.customRates.v1";
const boqStorageKey = "hhspaces.rateBoq.v1";
const assistantHistoryStorageKey = "hhspaces.rateAssistantHistory.v1";
const rateBackupStorageKey = "hhspaces.rateAnalyzer.lastBackup.v1";

type BathroomFormState = Omit<BathroomTileInput, "selectedRate" | "labourOnlyRate" | "materialOnlyRate" | "marginPercent" | "gstPercent">;

type RateAiEdgeResponse = {
  draft?: {
    response?: string;
    confidence?: number;
    missing_fields?: string[];
  };
  source?: string;
  error?: string;
};

type SpeechRecognitionResultLike = {
  0?: { transcript?: string };
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

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

const smartPromptPresets = [
  "4 by 8 bathroom complete tiling cost with 2x4 wall tile",
  "labour only 500 sqft internal plaster rate",
  "terrace waterproofing 800 sqft with material",
  "POP ceiling for 12 by 15 hall modern design",
  "electrical estimate for 3BHK",
  "wardrobe 100 sqft labour and material",
  "kitchen granite top with sink and hob cut",
  "bathroom waterproofing labour only 120 sqft"
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
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private mode, low storage, or locked-down browsers.
  }
}

function loadArrayJson<T>(key: string): T[] {
  const value = loadJson<unknown>(key, []);
  return Array.isArray(value) ? (value as T[]) : [];
}

function isStoredRateItem(value: unknown): value is RateItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RateItem>;
  return typeof item.id === "string" && typeof item.work === "string" && typeof item.unit === "string" && Boolean(item.rates);
}

function isStoredBoqRow(value: unknown): value is BoqRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<BoqRow>;
  return typeof row.id === "string" && typeof row.description === "string" && Number.isFinite(row.quantity) && Number.isFinite(row.rate);
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

function fileTimestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
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
    id: `custom-${fileTimestamp()}`,
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
      <input inputMode="decimal" min={min} step={step} type="number" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(numberValue(event.target.value))} />
    </label>
  );
}

export function RateIntelligenceScreen() {
  const quotePanelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const boqPanelRef = useRef<HTMLDivElement | null>(null);
  const adminPanelRef = useRef<HTMLDivElement | null>(null);
  const importBoxRef = useRef<HTMLTextAreaElement | null>(null);
  const [clientReady, setClientReady] = useState(false);
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
  const [assistantAnalysis, setAssistantAnalysis] = useState<RateAiAnalysis | null>(null);
  const [assistantRow, setAssistantRow] = useState<BoqRow | null>(null);
  const [assistantHistory, setAssistantHistory] = useState<string[]>([]);
  const [lastBackupIso, setLastBackupIso] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [selectedConditionKeys, setSelectedConditionKeys] = useState<SiteConditionKey[]>(["renovation"]);
  const [customerLanguage, setCustomerLanguage] = useState<"hinglish" | "english">("hinglish");
  const [cloudAiBusy, setCloudAiBusy] = useState(false);
  const [cloudAiInsight, setCloudAiInsight] = useState("");
  const [cloudAiIssue, setCloudAiIssue] = useState("");
  const [showRateBrowser, setShowRateBrowser] = useState(false);
  const [importText, setImportText] = useState("");
  const [measurementDraft, setMeasurementDraft] = useState({
    lengthFt: 4,
    widthFt: 8,
    heightFt: 7,
    count: 1,
    wastagePercent: 10
  });

  useEffect(() => {
    setClientReady(true);
  }, []);
  const [quantityNote, setQuantityNote] = useState("Search a work with size, then tap it. Example: 4x8 bathroom tiling cost.");
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
    setCustomRates(loadArrayJson<unknown>(customRateStorageKey).filter(isStoredRateItem));
    setBoqRows(loadArrayJson<unknown>(boqStorageKey).filter(isStoredBoqRow));
    setAssistantHistory(loadArrayJson<string>(assistantHistoryStorageKey).filter((item): item is string => typeof item === "string"));
    setLastBackupIso(loadJson<string | null>(rateBackupStorageKey, null));
  }, []);

  useEffect(() => {
    saveJson(customRateStorageKey, customRates);
  }, [customRates]);

  useEffect(() => {
    saveJson(boqStorageKey, boqRows);
  }, [boqRows]);

  useEffect(() => {
    saveJson(assistantHistoryStorageKey, assistantHistory);
  }, [assistantHistory]);

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
  const hasRateSearch = query.trim().length > 0;
  const showRateDatabase = showRateBrowser || hasRateSearch;

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
  const exactCost = detailedEstimate?.sellingPrice ?? quote.sellingPrice;
  const exactUnitCost = detailedEstimate?.perUnitSelling ?? quote.perUnitSelling;
  const rateDashboardSummary = useMemo(
    () =>
      buildRateAnalyzerSummary({
        catalog,
        customRateCount: customRates.length,
        boqRows,
        cityName: city.city,
        lastBackupIso
      }),
    [boqRows, catalog, city.city, customRates.length, lastBackupIso]
  );
  const profitProtection = useMemo(
    () =>
      selectedItem && detailedEstimate
        ? analyzeProfitProtection({
            item: selectedItem,
            estimate: detailedEstimate,
            quantity,
            quoteMode,
            context,
            gstPercent,
            selectedConditionKeys
          })
        : null,
    [context, detailedEstimate, gstPercent, quantity, quoteMode, selectedConditionKeys, selectedItem]
  );
  const customerBrief = useMemo(
    () =>
      selectedItem && detailedEstimate && profitProtection
        ? buildCustomerRateBrief({
            item: selectedItem,
            estimate: detailedEstimate,
            protection: profitProtection,
            quantity,
            quoteMode
          })
        : null,
    [detailedEstimate, profitProtection, quantity, quoteMode, selectedItem]
  );
  const matchingAssistantAnalysis = assistantAnalysis?.item?.id === selectedItem?.id ? assistantAnalysis : null;
  const rateDecisionEngine = useMemo(
    () =>
      selectedItem && detailedEstimate && profitProtection
        ? buildRateDecisionEngine({
            item: selectedItem,
            estimate: detailedEstimate,
            protection: profitProtection,
            quantity,
            quoteMode,
            context,
            gstPercent,
            missingFields: matchingAssistantAnalysis?.missingFields,
            warnings: matchingAssistantAnalysis?.warnings
          })
        : null,
    [context, detailedEstimate, gstPercent, matchingAssistantAnalysis?.missingFields, matchingAssistantAnalysis?.warnings, profitProtection, quantity, quoteMode, selectedItem]
  );

  function updateMeasurementDraft(key: keyof typeof measurementDraft, value: number) {
    setMeasurementDraft((current) => ({ ...current, [key]: value }));
  }

  function scrollToQuotePanel() {
    window.setTimeout(() => {
      quotePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function scrollToElement(element: HTMLElement | null) {
    window.setTimeout(() => element?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function markBackupSaved() {
    const next = new Date().toISOString();
    setLastBackupIso(next);
    saveJson(rateBackupStorageKey, next);
  }

  function toggleCondition(key: SiteConditionKey) {
    setSelectedConditionKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function startNewAnalysis() {
    setQuery("");
    setShowRateBrowser(true);
    if (selectedItem) setQuantity(defaultQuantityForRateItem(selectedItem));
    setQuantityNote("Search a work with size, then tap it. Example: 4x8 bathroom tiling cost.");
    window.setTimeout(() => searchInputRef.current?.focus(), 80);
  }

  function duplicatePreviousEstimate() {
    const previous = boqRows[0];
    if (!previous) {
      addSelectedToBoq();
      return;
    }
    setBoqRows((current) => [{ ...previous, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, description: `${previous.description} - copy` }, ...current]);
    setNotice("Previous estimate duplicated");
  }

  function jumpToImportRates() {
    scrollToElement(adminPanelRef.current);
    window.setTimeout(() => importBoxRef.current?.focus(), 250);
  }

  function selectRateItem(item: RateItem) {
    const inferred = inferQuantityFromText({
      text: query,
      item,
      defaultWallHeightFt: measurementDraft.heightFt,
      defaultWastagePercent: measurementDraft.wastagePercent
    });
    setSelectedItemId(item.id);
    setCategory(item.category);
    setQuantity(inferred.quantity);
    if (inferred.lengthFt || inferred.widthFt || inferred.heightFt || inferred.wastagePercent) {
      setMeasurementDraft((current) => ({
        ...current,
        lengthFt: inferred.lengthFt ?? current.lengthFt,
        widthFt: inferred.widthFt ?? current.widthFt,
        heightFt: inferred.heightFt ?? current.heightFt,
        wastagePercent: inferred.wastagePercent ?? current.wastagePercent
      }));
    } else {
      setMeasurementDraft((current) => ({
        ...current,
        count: defaultQuantityForRateItem(item)
      }));
    }
    setQuantityNote(inferred.note);
    setNotice(`Opened calculator: ${inferred.quantity} ${item.unit}`);
    scrollToQuotePanel();
  }

  function applyMeasurement(mode: "floor" | "wall" | "roomWalls" | "bathroom" | "running" | "count") {
    const lengthFt = Math.max(0, measurementDraft.lengthFt);
    const widthFt = Math.max(0, measurementDraft.widthFt);
    const heightFt = Math.max(0, measurementDraft.heightFt);
    const wastageFactor = 1 + Math.max(0, measurementDraft.wastagePercent) / 100;
    const count = Math.max(0, measurementDraft.count);
    let nextQuantity = quantity;
    let nextNote = "";

    if (mode === "floor") {
      nextQuantity = Math.round(lengthFt * widthFt * 100) / 100;
      nextNote = `Floor/ceiling area: ${lengthFt} x ${widthFt} = ${nextQuantity} ${selectedItem?.unit || "sqft"}.`;
    }
    if (mode === "wall") {
      nextQuantity = Math.round(lengthFt * heightFt * 100) / 100;
      nextNote = `Single wall area: ${lengthFt} x ${heightFt} = ${nextQuantity} ${selectedItem?.unit || "sqft"}.`;
    }
    if (mode === "roomWalls") {
      nextQuantity = Math.round(2 * (lengthFt + widthFt) * heightFt * 100) / 100;
      nextNote = `Room wall area: 2 x (${lengthFt} + ${widthFt}) x ${heightFt} = ${nextQuantity} ${selectedItem?.unit || "sqft"}.`;
    }
    if (mode === "bathroom") {
      const area = (2 * (lengthFt + widthFt) * heightFt + lengthFt * widthFt) * wastageFactor;
      nextQuantity = Math.round(area * 100) / 100;
      nextNote = `Bathroom tile area with floor, walls and ${measurementDraft.wastagePercent}% wastage: ${nextQuantity} ${selectedItem?.unit || "sqft"}.`;
    }
    if (mode === "running") {
      nextQuantity = selectedItem?.unit === "meter" ? Math.round((lengthFt / 3.28084) * 100) / 100 : lengthFt;
      nextNote = `Running length: ${nextQuantity} ${selectedItem?.unit || "rft"}.`;
    }
    if (mode === "count") {
      nextQuantity = count;
      nextNote = `Count/points: ${nextQuantity} ${selectedItem?.unit || "nos"}.`;
    }

    setQuantity(nextQuantity);
    setQuantityNote(nextNote);
    setNotice("Exact cost recalculated");
  }

  function addSelectedToBoq() {
    if (!selectedItem) return;
    const row = toBoqRow({
      description: selectedItem.work,
      unit: selectedItem.unit,
      quantity,
      rate: exactUnitCost || selectedRate,
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
    downloadFile(`hh-spaces-boq-${fileTimestamp()}.csv`, rowsToCsv(boqRows));
    markBackupSaved();
    setNotice("BOQ CSV generated");
  }

  async function exportBoqPdf() {
    if (!boqRows.length) {
      setNotice("Add at least one BOQ item first");
      return;
    }
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = autoTableModule.default;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text("H&H SPACES - BOQ Estimate", 40, 44);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 40, 62);
    autoTable(doc, {
      startY: 82,
      head: [["Sr", "Description", "Unit", "Qty", "Rate", "Amount", "GST %", "Total"]],
      body: boqRows.map((row, index) => [index + 1, row.description, row.unit, row.quantity, row.rate, row.amount, row.gstPercent, row.total]),
      foot: [["", "", "", "", "", totals.amount, totals.gst ? "GST" : "", totals.total]]
    });
    doc.save(`hh-spaces-boq-${fileTimestamp()}.pdf`);
    markBackupSaved();
    setNotice("BOQ PDF generated");
  }

  function exportBoqExcel() {
    if (!boqRows.length) {
      setNotice("Add at least one BOQ item first");
      return;
    }
    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table border="1">
            <thead><tr><th>Sr No</th><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate</th><th>Amount</th><th>GST %</th><th>Total</th></tr></thead>
            <tbody>
              ${boqRows
                .map((row, index) => `<tr><td>${index + 1}</td><td>${row.description}</td><td>${row.unit}</td><td>${row.quantity}</td><td>${row.rate}</td><td>${row.amount}</td><td>${row.gstPercent}</td><td>${row.total}</td></tr>`)
                .join("")}
              <tr><td colspan="5"><strong>Total</strong></td><td>${totals.amount}</td><td>${totals.gst}</td><td>${totals.total}</td></tr>
            </tbody>
          </table>
        </body>
      </html>`;
    downloadFile(`hh-spaces-boq-${fileTimestamp()}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
    markBackupSaved();
    setNotice("BOQ Excel file generated");
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
    downloadFile(`hh-spaces-rate-database-${fileTimestamp()}.csv`, header + body);
    markBackupSaved();
    setNotice("Rate database exported");
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

  function saveAssistantPrompt(text: string) {
    const cleaned = text.trim();
    if (!cleaned) return;
    setAssistantHistory((current) => [cleaned, ...current.filter((item) => item.toLowerCase() !== cleaned.toLowerCase())].slice(0, 8));
  }

  function analyzeAssistantText(text: string) {
    const analysis = analyzeRatePrompt({
      text,
      catalog,
      context,
      gstPercent,
      rateLevel,
      fallbackItem: selectedItem,
      defaultWallHeightFt: measurementDraft.heightFt,
      defaultWastagePercent: measurementDraft.wastagePercent
    });

    setAssistantAnalysis(analysis);
    setAssistantRow(analysis.boqRow);
    setAssistantResult(analysis.internalSummary);
    saveAssistantPrompt(text);

    if (!analysis.item || !analysis.quantity) {
      setNotice("Add work type and measurement for a stronger estimate");
      return;
    }

    setSelectedItemId(analysis.item.id);
    setCategory(analysis.item.category);
    setQuoteMode(analysis.quoteMode);
    setQuantity(analysis.quantity.quantity);
    setQuantityNote(analysis.quantity.note);

    if (analysis.quantity.lengthFt || analysis.quantity.widthFt || analysis.quantity.heightFt || analysis.quantity.wastagePercent) {
      setMeasurementDraft((current) => ({
        ...current,
        lengthFt: analysis.quantity?.lengthFt ?? current.lengthFt,
        widthFt: analysis.quantity?.widthFt ?? current.widthFt,
        heightFt: analysis.quantity?.heightFt ?? current.heightFt,
        wastagePercent: analysis.quantity?.wastagePercent ?? current.wastagePercent
      }));
    }

    if (analysis.quantity.method === "bathroom-area" && analysis.quantity.lengthFt && analysis.quantity.widthFt) {
      setBathroom((current) => ({
        ...current,
        lengthFt: analysis.quantity?.lengthFt ?? current.lengthFt,
        widthFt: analysis.quantity?.widthFt ?? current.widthFt,
        wallHeightFt: analysis.quantity?.heightFt ?? current.wallHeightFt,
        wastagePercent: analysis.quantity?.wastagePercent ?? current.wastagePercent
      }));
    }

    setNotice(`Smart analysis ready: ${Math.round(analysis.confidence * 100)}% confidence`);
    scrollToQuotePanel();
  }

  function runAssistant() {
    analyzeAssistantText(assistantText);
  }

  function applyPrompt(text: string) {
    setAssistantText(text);
    analyzeAssistantText(text);
  }

  function analyzeCurrentCalculator() {
    if (!selectedItem) {
      setNotice("Select a rate item first");
      return;
    }
    const modeText = quoteMode === "labourOnly" ? "labour only" : quoteMode === "materialOnly" ? "material only" : "labour and material";
    const prompt = `${modeText} ${quantity} ${selectedItem.unit} ${selectedItem.work} ${city.city} ${contractType}`;
    setAssistantText(prompt);
    analyzeAssistantText(prompt);
  }

  function compactRateAnalysis(analysis: RateAiAnalysis) {
    return {
      prompt: analysis.prompt,
      intent: analysis.intent,
      confidence: analysis.confidence,
      item: analysis.item
        ? {
            id: analysis.item.id,
            work: analysis.item.work,
            category: analysis.item.category,
            unit: analysis.item.unit,
            specification: analysis.item.specification,
            caution: analysis.item.caution
          }
        : null,
      quantity: analysis.quantity,
      quoteMode: analysis.quoteMode,
      precision: analysis.precision,
      estimate: analysis.estimate
        ? {
            labourCost: analysis.estimate.labourCost,
            materialCost: analysis.estimate.materialCost,
            overheadCost: analysis.estimate.overheadCost,
            profitCost: analysis.estimate.profitCost,
            gstCost: analysis.estimate.gstCost,
            sellingPrice: analysis.estimate.sellingPrice,
            perUnitSelling: analysis.estimate.perUnitSelling,
            productivityDays: analysis.estimate.productivityDays
          }
        : null,
      pricingStrategy: analysis.pricingStrategy,
      marketBands: analysis.marketBands,
      assumptions: analysis.assumptions,
      ratePlans: analysis.ratePlans,
      formulaLines: analysis.formulaLines,
      customerExplanation: analysis.customerExplanation,
      missingFields: analysis.missingFields,
      warnings: analysis.warnings,
      recommendations: analysis.recommendations,
      context: {
        city: city.city,
        state: city.state,
        contractType,
        areaPremiumPercent,
        gstPercent
      }
    };
  }

  async function askCloudAiForRate() {
    const analysis =
      assistantAnalysis ||
      analyzeRatePrompt({
        text: assistantText,
        catalog,
        context,
        gstPercent,
        rateLevel,
        fallbackItem: selectedItem,
        defaultWallHeightFt: measurementDraft.heightFt,
        defaultWastagePercent: measurementDraft.wastagePercent
      });

    setAssistantAnalysis(analysis);
    setAssistantRow(analysis.boqRow);
    setAssistantResult(analysis.internalSummary);
    setCloudAiIssue("");
    setCloudAiInsight("");

    if (!analysis.item || !analysis.estimate) {
      setCloudAiIssue("Add a clear work item and measurement before asking cloud AI.");
      return;
    }

    if (!supabase) {
      setCloudAiIssue("Cloud AI is not connected in this build. Local Smart Rate AI is active.");
      return;
    }

    setCloudAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<RateAiEdgeResponse>("ai-assistant", {
        body: {
          message: `Review this construction rate estimate and make it safer for customer quotation: ${assistantText}`,
          rate_analysis: compactRateAnalysis(analysis)
        }
      });
      if (error) throw error;
      const response = data?.draft?.response || data?.error || "";
      setCloudAiInsight(response || "Cloud AI checked this estimate. Use the local pricing cards for final numbers.");
      setNotice(data?.source === "openai" ? "Cloud AI review complete" : "AI fallback review complete");
    } catch {
      setCloudAiIssue("Cloud AI could not respond. Local Smart Rate AI is still available.");
    } finally {
      setCloudAiBusy(false);
    }
  }

  function startVoiceInput() {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("Voice input is not supported in this browser. Type the estimate instead.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript || "")
        .join(" ")
        .trim();
      if (transcript) {
        setAssistantText(transcript);
        setVoiceStatus(`Heard: ${transcript}`);
        setNotice("Voice captured. Review it, then tap Analyze Text.");
      }
    };
    recognition.onerror = () => {
      setVoiceStatus("Voice capture failed. Check microphone permission or type instead.");
    };
    recognition.onend = () => {
      setVoiceStatus((current) => current || "Voice capture finished.");
    };
    setVoiceStatus("Listening...");
    recognition.start();
  }

  const customerExplanation = customerBrief
    ? {
        title: customerLanguage === "hinglish" ? customerBrief.hinglishTitle : customerBrief.title,
        oneLineAnswer: customerLanguage === "hinglish" ? customerBrief.hinglishOneLineAnswer : customerBrief.oneLineAnswer,
        scope: customerLanguage === "hinglish" ? customerBrief.hinglishScope : customerBrief.customerScope,
        exclusions: customerLanguage === "hinglish" ? customerBrief.hinglishExclusions : customerBrief.customerExclusions,
        talkingPoints: customerLanguage === "hinglish" ? customerBrief.hinglishTalkingPoints : customerBrief.talkingPoints
      }
    : null;

  const customerMessage =
    rateDecisionEngine?.whatsAppSummary ||
    [
      "H&H SPACES Quotation Estimate",
      selectedItem ? `Work: ${selectedItem.work}` : "",
      `Qty: ${quantity} ${selectedItem?.unit || "unit"}`,
      `Rate: ${formatMoney(exactUnitCost)} / ${selectedItem?.unit || "unit"}`,
      `Estimated total: ${formatMoney(profitProtection?.recommendedTotal ?? exactCost)}`,
      profitProtection ? `Safe negotiation floor: ${formatMoney(profitProtection.safeFloor)}` : "",
      customerExplanation ? `Customer explanation: ${customerExplanation.oneLineAnswer}` : "",
      customerExplanation ? `Scope: ${customerExplanation.scope.slice(0, 3).join(", ")}` : "",
      customerExplanation ? `Not included: ${customerExplanation.exclusions.slice(0, 2).join(", ")}` : "",
      profitProtection?.warnings.length ? `Check before final: ${profitProtection.warnings.slice(0, 2).join(" ")}` : "",
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

      <div className={styles.rateDashboardGrid} aria-label="Rate analyzer dashboard">
        {rateDashboardSummary.cards.map((card) => (
          <div className={styles.rateDashboardCard} data-tone={card.tone} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </div>
        ))}
      </div>

      <Card className={styles.quickCommandCard}>
        <CardHeader title="Fast Contractor Actions" subtitle="Everything here performs a real action: calculate, create BOQ, copy quotation, import rates, or open saved estimates." />
        <div className={styles.quickActionGrid}>
          <button type="button" onClick={startNewAnalysis}>
            <strong>New Rate Analysis</strong>
            <span>Search any work</span>
          </button>
          <button type="button" onClick={scrollToQuotePanel}>
            <strong>Quick Calculator</strong>
            <span>Open exact cost</span>
          </button>
          <button type="button" onClick={addSelectedToBoq}>
            <strong>Create BOQ</strong>
            <span>Add selected item</span>
          </button>
          <button type="button" onClick={() => void copyText(customerMessage, "Client quotation copied")}>
            <strong>Create Quotation</strong>
            <span>Copy customer text</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowRateBrowser(true);
              setNotice("Rate comparison opened");
            }}
          >
            <strong>Compare Rates</strong>
            <span>Economy to premium</span>
          </button>
          <button type="button" onClick={() => scrollToElement(adminPanelRef.current)}>
            <strong>Add Market Rate</strong>
            <span>Save custom rate</span>
          </button>
          <button type="button" onClick={jumpToImportRates}>
            <strong>Import Rate Sheet</strong>
            <span>Paste CSV rows</span>
          </button>
          <button type="button" onClick={jumpToImportRates}>
            <strong>Update Material Prices</strong>
            <span>Bulk update CSV</span>
          </button>
          <button type="button" onClick={() => scrollToElement(boqPanelRef.current)}>
            <strong>Open Saved Estimates</strong>
            <span>{boqRows.length} BOQ rows</span>
          </button>
          <button type="button" onClick={duplicatePreviousEstimate}>
            <strong>Duplicate Previous</strong>
            <span>Reuse last estimate</span>
          </button>
        </div>
      </Card>

      <details className={styles.advancedCard}>
        <summary>
          <span>
            <strong>Advanced price settings</strong>
            <small>
              {city.city} - {contractType} - {rateLevels.find((level) => level.key === rateLevel)?.label || "Standard"} rate
            </small>
          </span>
          <Badge tone="info">Optional</Badge>
        </summary>
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
      </details>

      <SectionTitle title="Instant Search" subtitle="Find any work: POP, 2x4 tile, waterproofing, electrician point, carpenter, plaster." />
      <div className={styles.searchBar}>
        <input
          ref={searchInputRef}
          aria-label="Search rates"
          placeholder="Search any work rate"
          value={query}
          disabled={!clientReady}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select aria-label="Sort rate level" value={rateLevel} onChange={(event) => setRateLevel(event.target.value as RateLevel)}>
          {rateLevels.map((level) => (
            <option key={level.key} value={level.key}>
              {level.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.simpleActions}>
        <Button
          variant="secondary"
          onClick={() => {
            if (showRateDatabase) {
              setShowRateBrowser(false);
              setQuery("");
              return;
            }
            setShowRateBrowser(true);
          }}
        >
          {showRateDatabase ? "Hide Rate List" : "Browse Rate List"}
        </Button>
        {hasRateSearch ? (
          <Button variant="ghost" onClick={() => setQuery("")}>
            Clear Search
          </Button>
        ) : null}
      </div>

      {showRateDatabase ? (
        <>
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
                  onClick={() => selectRateItem(item)}
                >
                  <span className={styles.rateCardTop}>
                    <strong>{item.work}</strong>
                    <Badge tone={active ? "success" : "neutral"}>{item.unit}</Badge>
                  </span>
                  <span>{moneyRange(item, city, contractType, areaPremiumPercent)}</span>
                  <span className={styles.subcategory}>{item.details?.subcategory || item.subcategory}</span>
                  <span className={styles.miniMatrix}>
                    Labour {formatMoney(rateForItem(item, "labourOnly", context))} - Material {formatMoney(rateForItem(item, "materialOnly", context))} - L+M {formatMoney(rateForItem(item, "labourMaterial", context))}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className={styles.simpleStart}>
          <strong>Start simple</strong>
          <p>Type the work above or use Smart Rate AI. The full market rate list is hidden until you need it.</p>
        </div>
      )}

      {selectedItem && showRateDatabase ? (
        <Card>
          <CardHeader title={selectedItem.work} subtitle={`${selectedItem.category}  -  ${city.city}  -  ${contractType}`} action={<Badge tone="info">{selectedItem.unit}</Badge>} />
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
                  {selectedItem.details.skilledWorkersRequired} skilled  -  {selectedItem.details.helpersRequired} helper
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

      <div ref={quotePanelRef}>
        <Card>
        <CardHeader title="Quick Customer Quote" subtitle="Tap any search result to open this calculator with inferred area and exact cost." />
        <div className={styles.exactCostBanner}>
          <div>
            <span>Exact customer cost</span>
            <strong>{formatMoney(profitProtection?.recommendedTotal ?? exactCost)}</strong>
            <p>
              {selectedItem?.work || "Selected work"}  -  {quantity} {selectedItem?.unit || "unit"} x {formatMoney(exactUnitCost)} / {selectedItem?.unit || "unit"}
            </p>
          </div>
          <Badge tone="success">{quoteMode === "labourOnly" ? "Labour only" : quoteMode === "materialOnly" ? "Material only" : "Labour + Material"}</Badge>
        </div>
        {rateDecisionEngine ? (
          <div className={styles.engineCard} data-status={rateDecisionEngine.status}>
            <div className={styles.engineTop}>
              <div>
                <span>Rate Engine Decision</span>
                <strong>{rateDecisionEngine.headline}</strong>
                <p>{rateDecisionEngine.decision}</p>
              </div>
              <Badge tone={rateDecisionEngine.status === "high_risk" ? "danger" : rateDecisionEngine.status === "confirm_first" ? "warning" : "success"}>
                {rateDecisionEngine.confidenceScore}% confidence
              </Badge>
            </div>
            <div className={styles.engineQuoteStrip}>
              <div>
                <span>Customer Total</span>
                <strong>{formatMoney(rateDecisionEngine.customerTotal)}</strong>
              </div>
              <div>
                <span>Rate</span>
                <strong>
                  {formatMoney(rateDecisionEngine.customerRatePerUnit)} / {selectedItem?.unit}
                </strong>
              </div>
              <div>
                <span>Do Not Go Below</span>
                <strong>{formatMoney(rateDecisionEngine.negotiationFloor)}</strong>
              </div>
              <div>
                <span>Premium Option</span>
                <strong>{formatMoney(rateDecisionEngine.premiumTotal)}</strong>
              </div>
            </div>
            <div className={styles.engineScript}>
              <div className={styles.customerBriefHeader}>
                <div>
                  <span>Explain To Customer</span>
                  <strong>{customerLanguage === "hinglish" ? "Hinglish script" : "English script"}</strong>
                </div>
                <div className={styles.languageSwitch} aria-label="Rate engine explanation language">
                  <button aria-pressed={customerLanguage === "hinglish"} type="button" onClick={() => setCustomerLanguage("hinglish")}>
                    Hinglish
                  </button>
                  <button aria-pressed={customerLanguage === "english"} type="button" onClick={() => setCustomerLanguage("english")}>
                    English
                  </button>
                </div>
              </div>
              <p>{customerLanguage === "hinglish" ? rateDecisionEngine.hinglishScript : rateDecisionEngine.customerScript}</p>
            </div>
            <details className={styles.engineDetails}>
              <summary>
                <span>Why this quote is safe</span>
                <strong>Open calculation logic</strong>
              </summary>
              <div className={styles.engineColumns}>
                <div>
                  <h3>Missing Charges To Confirm</h3>
                  {rateDecisionEngine.missingCharges.slice(0, 6).map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
                <div>
                  <h3>Guardrails</h3>
                  {rateDecisionEngine.guardrails.slice(0, 6).map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
              <div className={styles.engineBandGrid}>
                {rateDecisionEngine.rateBands.slice(0, 6).map((band) => (
                  <div key={band.label}>
                    <span>{band.label}</span>
                    <strong>{formatMoney(band.total)}</strong>
                    <p>
                      {formatMoney(band.rate)} / {selectedItem?.unit} - {band.useCase}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        ) : null}
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
        <div className={styles.conditionPanel}>
          <div className={styles.dimensionHeader}>
            <div>
              <strong>Site Condition Multipliers</strong>
              <span>Select real site difficulties. The engine protects labour, transport, risk and profit.</span>
            </div>
            <Badge tone={selectedConditionKeys.length ? "warning" : "info"}>{selectedConditionKeys.length} active</Badge>
          </div>
          <div className={styles.conditionGrid}>
            {siteConditionMultipliers.map((condition) => (
              <button
                aria-pressed={selectedConditionKeys.includes(condition.key)}
                key={condition.key}
                type="button"
                onClick={() => toggleCondition(condition.key)}
              >
                <strong>{condition.label}</strong>
                <span>+{condition.percent}%</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.dimensionPanel}>
          <div className={styles.dimensionHeader}>
            <div>
              <strong>Area & Quantity Calculator</strong>
              <span>{quantityNote}</span>
            </div>
            <Badge tone="info">Auto cost</Badge>
          </div>
          <div className={styles.grid3}>
            <NumberField label="Length ft" value={measurementDraft.lengthFt} step="0.1" onChange={(value) => updateMeasurementDraft("lengthFt", value)} />
            <NumberField label="Width ft" value={measurementDraft.widthFt} step="0.1" onChange={(value) => updateMeasurementDraft("widthFt", value)} />
            <NumberField label="Height ft" value={measurementDraft.heightFt} step="0.1" onChange={(value) => updateMeasurementDraft("heightFt", value)} />
            <NumberField label="Count / Points" value={measurementDraft.count} step="1" onChange={(value) => updateMeasurementDraft("count", value)} />
            <NumberField label="Wastage %" value={measurementDraft.wastagePercent} step="1" onChange={(value) => updateMeasurementDraft("wastagePercent", value)} />
          </div>
          <div className={styles.formulaButtons}>
            <button type="button" onClick={() => applyMeasurement("floor")}>
              Floor/Ceiling Area
            </button>
            <button type="button" onClick={() => applyMeasurement("wall")}>
              Single Wall Area
            </button>
            <button type="button" onClick={() => applyMeasurement("roomWalls")}>
              Room Wall Area
            </button>
            <button type="button" onClick={() => applyMeasurement("bathroom")}>
              Bathroom Tile Area
            </button>
            <button type="button" onClick={() => applyMeasurement("running")}>
              Running Length
            </button>
            <button type="button" onClick={() => applyMeasurement("count")}>
              Count / Points
            </button>
          </div>
        </div>
        <div className={styles.resultGrid}>
          <div>
            <span>Labour</span>
            <strong>{formatMoney(detailedEstimate?.labourCost ?? quote.labourCost)}</strong>
          </div>
          <div>
            <span>Material</span>
            <strong>{formatMoney(detailedEstimate?.materialCost ?? quote.materialCost)}</strong>
          </div>
          <div>
            <span>Profit</span>
            <strong>{formatMoney(detailedEstimate?.profitCost ?? quote.profitCost)}</strong>
          </div>
          <div>
            <span>Customer Quote</span>
            <strong>{formatMoney(profitProtection?.recommendedTotal ?? exactCost)}</strong>
          </div>
        </div>
        {profitProtection ? (
          <div className={styles.profitProtectionPanel}>
            <div className={styles.protectionHeader}>
              <div>
                <span>Profit Protection</span>
                <strong>{profitProtection.warnings.length ? "Check before final quote" : "Safe to discuss with customer"}</strong>
                <p>
                  Minimum profit rule: {profitProtection.minimumProfitPercent}% for {selectedItem?.category || "this work"}.
                </p>
              </div>
              <Badge tone={profitProtection.riskLevel === "high" ? "danger" : profitProtection.riskLevel === "medium" ? "warning" : "success"}>
                {profitProtection.riskLevel} risk
              </Badge>
            </div>
            <div className={styles.warningGrid}>
              {(profitProtection.warnings.length ? profitProtection.warnings : ["No major profit warning. Still confirm measurement, material brand and site condition."]).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
            <div className={styles.aiPlanGrid}>
              {profitProtection.comparisonPlans.map((plan) => (
                <div key={plan.label}>
                  <span>{plan.label}</span>
                  <strong>{formatMoney(plan.total)}</strong>
                  <p>
                    {formatMoney(plan.rate)} / {selectedItem?.unit} - {plan.riskLevel} risk - {plan.finish}
                  </p>
                </div>
              ))}
            </div>
            <div className={styles.aiExplainGrid}>
              <div>
                <h3>Smart Suggestions</h3>
                {profitProtection.suggestions.slice(0, 6).map((suggestion) => (
                  <p key={suggestion}>{suggestion}</p>
                ))}
              </div>
              <div>
                <h3>How Calculated</h3>
                {profitProtection.transparencyLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <div className={styles.aiReasonBox}>
              <h3>Negotiation Mode</h3>
              {profitProtection.negotiationMoves.map((move) => (
                <p key={move}>{move}</p>
              ))}
            </div>
          </div>
        ) : null}
        {customerExplanation ? (
          <div className={styles.customerBrief}>
            <div>
              <div className={styles.customerBriefHeader}>
                <div>
                  <span>Customer Explanation</span>
                  <strong>{customerExplanation.title}</strong>
                </div>
                <div className={styles.languageSwitch} aria-label="Customer explanation language">
                  <button aria-pressed={customerLanguage === "hinglish"} type="button" onClick={() => setCustomerLanguage("hinglish")}>
                    Hinglish
                  </button>
                  <button aria-pressed={customerLanguage === "english"} type="button" onClick={() => setCustomerLanguage("english")}>
                    English
                  </button>
                </div>
              </div>
              <p>{customerExplanation.oneLineAnswer}</p>
            </div>
            <div className={styles.aiScopeGrid}>
              <div>
                <h3>{customerLanguage === "hinglish" ? "Customer Ko Bolna" : "Show Customer"}</h3>
                {customerExplanation.scope.slice(0, 5).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div>
                <h3>{customerLanguage === "hinglish" ? "Simple Script" : "Talking Points"}</h3>
                {customerExplanation.talkingPoints.slice(0, 4).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <div>
                <h3>Hide Internals</h3>
                <p>Labour wages</p>
                <p>Purchase rates</p>
                <p>Profit margin</p>
                <p>Supplier notes</p>
              </div>
              <div>
                <h3>{customerLanguage === "hinglish" ? "Extra Lagega Agar" : "Not Included"}</h3>
                {customerExplanation.exclusions.slice(0, 5).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {detailedEstimate ? (
          <div className={styles.itemizedPanel}>
            <div className={styles.itemizedHeader}>
              <div>
                <strong>Itemized Analyzer</strong>
                <span>
                  {detailedEstimate.productivityDays} working day estimate  -  contractor cost {formatMoney(detailedEstimate.contractorCost)}
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
      </div>

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
            <span>{formatMoney(labourResult.perUnitCost)} base cost per unit  -  profit {formatMoney(labourResult.profit)}</span>
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
            <span>{electricalResult.wireLengthFt} ft wire  -  {electricalResult.conduitLengthFt} ft conduit  -  {electricalResult.pointCount} points</span>
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
            <span>{carpenterResult.plywoodSheets} plywood sheets  -  {carpenterResult.laminateSheets} laminate sheets  -  hardware {formatMoney(carpenterResult.hardwareCost)}</span>
          </div>
        </Card>
      </div>

      <Card className={styles.aiQuickCard} id="smart-rate-ai">
        <CardHeader title="Smart Rate AI" subtitle="Type natural language. It finds the work item, calculates quantity, builds exact cost and creates an editable BOQ draft." />
        <div className={styles.smartPromptGrid} aria-label="Quick estimate prompts">
          {smartPromptPresets.map((prompt) => (
            <button key={prompt} type="button" onClick={() => applyPrompt(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
        <textarea
          aria-label="Describe work for AI estimate"
          className={styles.assistantInput}
          placeholder="Example: 4 by 8 bathroom tiling labour and material"
          value={assistantText}
          onChange={(event) => setAssistantText(event.target.value)}
        />
        <div className={styles.actionRow}>
          <Button onClick={runAssistant}>Analyze Text</Button>
          <Button variant="secondary" onClick={startVoiceInput}>
            Voice Input
          </Button>
          <Button variant="secondary" onClick={analyzeCurrentCalculator}>
            Analyze Current Calculator
          </Button>
          <Button variant="secondary" onClick={() => void askCloudAiForRate()} disabled={cloudAiBusy}>
            {cloudAiBusy ? "AI Checking..." : "AI Deep Check"}
          </Button>
          {assistantAnalysis?.estimate ? (
            <Button variant="secondary" onClick={() => void copyText(analysisToWhatsAppMessage(assistantAnalysis), "Smart estimate copied for WhatsApp")}>
              Copy Customer Estimate
            </Button>
          ) : null}
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
        {voiceStatus ? <p className={styles.voiceStatus}>{voiceStatus}</p> : null}
        {assistantHistory.length ? (
          <div className={styles.recentPromptBox}>
            <span>Recent smart estimates</span>
            <div>
              {assistantHistory.map((prompt) => (
                <button key={prompt} type="button" onClick={() => applyPrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {cloudAiInsight || cloudAiIssue ? (
          <div className={cloudAiIssue ? styles.aiCloudIssue : styles.aiCloudInsight}>
            <strong>{cloudAiIssue ? "Cloud AI Status" : "Cloud AI Review"}</strong>
            <p>{cloudAiIssue || cloudAiInsight}</p>
          </div>
        ) : null}
        {assistantAnalysis ? (
          <div className={styles.aiPanel}>
            <div className={styles.aiPanelHeader}>
              <div>
                <span>AI Rate Brain</span>
                <strong>{assistantAnalysis.item?.work || "Need more information"}</strong>
                <p>
                  {assistantAnalysis.item?.category || "No category"}  -  {assistantAnalysis.quoteMode.replace(/([A-Z])/g, " $1").toLowerCase()}  - {" "}
                  {Math.round(assistantAnalysis.confidence * 100)}% confidence
                </p>
              </div>
              <Badge tone={assistantAnalysis.confidence >= 0.7 ? "success" : assistantAnalysis.confidence >= 0.45 ? "warning" : "danger"}>
                {assistantAnalysis.quantity?.method === "default" ? "Needs size" : "Calculated"}
              </Badge>
            </div>

            {assistantAnalysis.estimate && assistantAnalysis.quantity ? (
              <>
                <div className={styles.aiExactTotal}>
                  <span>Exact customer estimate</span>
                  <strong>{formatMoney(assistantAnalysis.estimate.sellingPrice)}</strong>
                  <p>
                    {assistantAnalysis.quantity.quantity} {assistantAnalysis.item?.unit}  -  {formatMoney(assistantAnalysis.estimate.perUnitSelling)} / {assistantAnalysis.item?.unit}
                  </p>
                </div>

                <div className={styles.aiStatGrid}>
                  <div>
                    <span>Labour</span>
                    <strong>{formatMoney(assistantAnalysis.estimate.labourCost)}</strong>
                  </div>
                  <div>
                    <span>Material</span>
                    <strong>{formatMoney(assistantAnalysis.estimate.materialCost)}</strong>
                  </div>
                  <div>
                    <span>Profit</span>
                    <strong>{formatMoney(assistantAnalysis.estimate.profitCost)}</strong>
                  </div>
                  <div>
                    <span>GST</span>
                    <strong>{formatMoney(assistantAnalysis.estimate.gstCost)}</strong>
                  </div>
                </div>

                <div className={styles.aiPrecisionStrip}>
                  <div>
                    <span>Precision</span>
                    <strong>{assistantAnalysis.precision.label}</strong>
                    <p>
                      {assistantAnalysis.precision.score}% - {assistantAnalysis.precision.reason}
                    </p>
                  </div>
                  <div>
                    <span>Best customer rate</span>
                    <strong>{formatMoney(assistantAnalysis.pricingStrategy?.suggestedPerUnitRate || assistantAnalysis.estimate.perUnitSelling)} / {assistantAnalysis.item?.unit}</strong>
                    <p>Use this for a quick customer discussion, then confirm site measurements.</p>
                  </div>
                </div>

                {assistantAnalysis.ratePlans.length ? (
                  <div className={styles.aiPlanGrid}>
                    {assistantAnalysis.ratePlans.map((plan) => (
                      <div key={`${plan.label}-${plan.rateLevel}`}>
                        <span>{plan.label}</span>
                        <strong>{formatMoney(plan.total)}</strong>
                        <p>
                          {formatMoney(plan.unitRate)} / {assistantAnalysis.item?.unit} - {plan.useCase}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {assistantAnalysis.pricingStrategy ? (
              <div className={styles.aiStrategyGrid}>
                <div>
                  <span>Negotiation Floor</span>
                  <strong>{formatMoney(assistantAnalysis.pricingStrategy.negotiationFloor)}</strong>
                  <p>Do not go below this without changing scope.</p>
                </div>
                <div>
                  <span>Recommended Quote</span>
                  <strong>{formatMoney(assistantAnalysis.pricingStrategy.recommendedTotal)}</strong>
                  <p>{assistantAnalysis.pricingStrategy.profitMarginPercent}% estimated margin.</p>
                </div>
                <div>
                  <span>Premium Quote</span>
                  <strong>{formatMoney(assistantAnalysis.pricingStrategy.premiumTotal)}</strong>
                  <p>{assistantAnalysis.pricingStrategy.riskLevel} risk - {assistantAnalysis.pricingStrategy.riskBufferPercent}% buffer.</p>
                </div>
                <div>
                  <span>Break Even</span>
                  <strong>{formatMoney(assistantAnalysis.pricingStrategy.breakEvenTotal)}</strong>
                  <p>{formatMoney(assistantAnalysis.pricingStrategy.suggestedPerUnitRate)} / unit suggested.</p>
                </div>
              </div>
            ) : null}

            {assistantAnalysis.marketBands ? (
              <div className={styles.aiMarketGrid}>
                <span>Lowest {formatMoney(assistantAnalysis.marketBands.lowest)}</span>
                <span>Standard {formatMoney(assistantAnalysis.marketBands.standard)}</span>
                <span>Premium {formatMoney(assistantAnalysis.marketBands.premium)}</span>
                <span>Luxury {formatMoney(assistantAnalysis.marketBands.luxury)}</span>
              </div>
            ) : null}

            {(assistantAnalysis.assumptions.length || assistantAnalysis.formulaLines.length) && assistantAnalysis.item ? (
              <div className={styles.aiExplainGrid}>
                <div>
                  <h3>Assumptions</h3>
                  {assistantAnalysis.assumptions.slice(0, 6).map((item) => (
                    <p key={`${item.label}-${item.value}`}>
                      <strong>{item.label}:</strong> {item.value}
                    </p>
                  ))}
                </div>
                <div>
                  <h3>Formula Used</h3>
                  {assistantAnalysis.formulaLines.slice(0, 6).map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
            ) : null}

            {assistantAnalysis.customerExplanation.customerSpecification ? (
              <div className={styles.aiCustomerBox}>
                <div>
                  <span>Customer-ready explanation</span>
                  <strong>{assistantAnalysis.customerExplanation.plainLanguageSummary}</strong>
                  <p>{assistantAnalysis.customerExplanation.customerSpecification}</p>
                </div>
                <div className={styles.aiScopeGrid}>
                  <div>
                    <h3>Included</h3>
                    {assistantAnalysis.customerExplanation.included.slice(0, 6).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                  <div>
                    <h3>Not Included</h3>
                    {assistantAnalysis.customerExplanation.notIncluded.slice(0, 6).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                  <div>
                    <h3>Confirm Before Final</h3>
                    {assistantAnalysis.customerExplanation.confirmBeforeFinal.slice(0, 6).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
                <div className={styles.aiLogicChecks}>
                  {assistantAnalysis.customerExplanation.logicChecks.map((check) => (
                    <div key={check.label} data-status={check.status}>
                      <span>{check.label}</span>
                      <strong>{check.status === "ok" ? "OK" : check.status === "check" ? "Check" : "Risk"}</strong>
                      <p>{check.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles.aiColumns}>
              <div>
                <h3>Missing / Risk</h3>
                {(assistantAnalysis.missingFields.length || assistantAnalysis.warnings.length ? [...assistantAnalysis.missingFields, ...assistantAnalysis.warnings] : ["No major missing details detected."]).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
              <div>
                <h3>Smart Advice</h3>
                {assistantAnalysis.recommendations.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>

            {assistantAnalysis.confidenceReasons.length ? (
              <div className={styles.aiReasonBox}>
                <h3>Why this answer?</h3>
                {assistantAnalysis.confidenceReasons.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}

            {assistantAnalysis.alternatives.length ? (
              <div className={styles.aiAlternatives}>
                <span>Other possible matches</span>
                <div>
                  {assistantAnalysis.alternatives.map((item) => (
                    <button key={item.id} type="button" onClick={() => selectRateItem(item)}>
                      {item.work}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {assistantAnalysis.source ? (
              <p className={styles.aiSource}>
                Source: {assistantAnalysis.source.category}  -  {assistantAnalysis.source.city}  -  rate valid {assistantAnalysis.source.rateValidityDate || "as per database"}
              </p>
            ) : null}
          </div>
        ) : null}
        {assistantResult && !assistantAnalysis ? <p className={styles.assistantResult}>{assistantResult}</p> : null}
      </Card>

      <div ref={boqPanelRef}>
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
                    {row.quantity} {row.unit} x {formatMoney(row.rate)}  -  GST {row.gstPercent}%
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
          <Button onClick={exportBoqPdf}>Export PDF</Button>
          <Button variant="secondary" onClick={exportBoqExcel}>
            Export Excel
          </Button>
          <Button variant="secondary" onClick={exportBoq}>
            Export CSV
          </Button>
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
      </div>

      <div ref={adminPanelRef}>
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
        <textarea ref={importBoxRef} className={styles.assistantInput} placeholder="Import CSV rows: Category,Work,Unit,Standard,Labour,Material" value={importText} onChange={(event) => setImportText(event.target.value)} />
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
      </div>

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
