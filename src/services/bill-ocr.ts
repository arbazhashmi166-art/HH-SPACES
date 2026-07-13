import { todayIso } from "@/utils/format";

export type BillOcrDraft = {
  date: string;
  supplier_name: string;
  supplier_mobile: string;
  bill_number: string;
  gst_number: string;
  material_name: string;
  quantity: string;
  unit: string;
  rate: string;
  total: string;
  notes: string;
};

export type BillOcrPass = {
  name: string;
  confidence: number;
  score: number;
  textLength: number;
};

export type BillOcrResult = {
  text: string;
  confidence: number;
  draft: Partial<BillOcrDraft>;
  passes: BillOcrPass[];
  warnings: string[];
};

type ScanProgress = {
  status: string;
  progress: number;
  passName?: string;
};

type ScanOptions = {
  onProgress?: (progress: ScanProgress) => void;
};

type OcrVariant = {
  name: string;
  image: Blob;
  psm: "3" | "4" | "6" | "11";
};

type NumberToken = {
  value: number;
  raw: string;
  line: string;
  index: number;
};

const materialPatterns = [
  { pattern: /\bcement\b/i, name: "Cement", unit: "Bag" },
  { pattern: /\bsand\b/i, name: "Sand", unit: "Ton" },
  { pattern: /\b(pop|p\.o\.p|plaster of paris)\b/i, name: "POP", unit: "Bag" },
  { pattern: /\btile|tiles\b/i, name: "Tiles", unit: "Box" },
  { pattern: /\bpaint\b/i, name: "Paint", unit: "Litre" },
  { pattern: /\bsteel|sariya|rebar\b/i, name: "Steel", unit: "Kg" },
  { pattern: /\bwire|cable\b/i, name: "Wire", unit: "RFT" },
  { pattern: /\bwaterproof|chemical|dr\.?\s*fixit\b/i, name: "Waterproofing Material", unit: "Litre" },
  { pattern: /\bbrick|blocks?\b/i, name: "Bricks", unit: "Nos" },
  { pattern: /\baggregate|gravel|metal\b/i, name: "Aggregate", unit: "Ton" },
  { pattern: /\bputty\b/i, name: "Putty", unit: "Bag" },
  { pattern: /\bprimer\b/i, name: "Primer", unit: "Litre" },
  { pattern: /\bplaster\b/i, name: "Plaster Material", unit: "Sqft" },
  { pattern: /\brcc|concrete|ready mix\b/i, name: "RCC Material", unit: "Cum" },
  { pattern: /\bpipe|pvc|cpvc|upvc\b/i, name: "Pipe", unit: "RFT" },
  { pattern: /\bply|plywood|laminate\b/i, name: "Plywood", unit: "Sheet" }
];

const unitPatterns = [
  { pattern: /\bbags?\b/i, unit: "Bag" },
  { pattern: /\bkgs?|kilograms?\b/i, unit: "Kg" },
  { pattern: /\btons?|tonne\b/i, unit: "Ton" },
  { pattern: /\bsq\.?\s*ft|sqft|square\s*feet\b/i, unit: "Sqft" },
  { pattern: /\brft|running\s*feet|feet|ft\b/i, unit: "RFT" },
  { pattern: /\bnos?\.?|numbers?|pcs?|pieces?\b/i, unit: "Nos" },
  { pattern: /\bbox(?:es)?\b/i, unit: "Box" },
  { pattern: /\blit(?:re|er)?s?|ltr\b/i, unit: "Litre" },
  { pattern: /\bsheets?\b/i, unit: "Sheet" },
  { pattern: /\bcum|cubic\s*meter\b/i, unit: "Cum" }
];

const rupeeAmount = /(?:rs\.?|inr|₹)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;

export function parseBillText(rawText: string): Partial<BillOcrDraft> {
  const text = normalizeOcrText(rawText);
  const lines = getCleanLines(text);
  const total = extractTotal(lines);
  const item = extractItem(lines, total);
  const materialGuess = extractMaterial(text);
  const supplier = extractSupplier(lines);
  const supplierMobile = extractMobile(text);
  const gstNumber = extractGstNumber(text);
  const billNumber = extractBillNumber(lines);
  const date = normalizeDate(text);
  const quantity = item.quantity || extractQuantity(text) || 1;
  const rate = item.rate || extractRate(text) || (quantity && total ? total / quantity : 0);
  const materialName = item.materialName || materialGuess.name;
  const unit = item.unit || materialGuess.unit || extractUnit(text) || "Nos";

  const notes = [
    gstNumber ? `GSTIN: ${gstNumber}` : "",
    billNumber ? `Bill No: ${billNumber}` : "",
    text.slice(0, 1200)
  ]
    .filter(Boolean)
    .join("\n");

  return {
    date,
    supplier_name: supplier.slice(0, 90),
    supplier_mobile: supplierMobile,
    bill_number: billNumber,
    gst_number: gstNumber,
    material_name: materialName,
    quantity: String(roundMoney(quantity || 1)),
    unit,
    rate: String(roundMoney(rate || 0)),
    total: String(roundMoney(total || (quantity && rate ? quantity * rate : 0))),
    notes
  };
}

export async function scanBillImage(file: File, options: ScanOptions = {}): Promise<BillOcrResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("OCR works only in the browser");
  }

  options.onProgress?.({ status: "Preparing bill photo", progress: 0.04 });
  const variants = await createOcrVariants(file);
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker("eng", undefined, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        options.onProgress?.({
          status: "Reading text",
          progress: Math.max(0.12, Math.min(0.95, message.progress)),
          passName: message.userJobId || undefined
        });
      }
    }
  });

  const passResults: Array<BillOcrPass & { text: string }> = [];

  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      user_defined_dpi: "300"
    });

    for (const variant of variants) {
      options.onProgress?.({ status: `Scanning ${variant.name}`, progress: 0.12, passName: variant.name });
      await worker.setParameters({ tessedit_pageseg_mode: variant.psm as Tesseract.PSM });
      const result = await worker.recognize(variant.image, { rotateAuto: true }, undefined, variant.name);
      const text = normalizeOcrText(result.data.text || "");
      const confidence = Number.isFinite(result.data.confidence) ? result.data.confidence : 0;
      const score = scoreOcrText(text, confidence);
      passResults.push({
        name: variant.name,
        confidence,
        score,
        textLength: text.trim().length,
        text
      });

      if (score >= 86 && text.length > 80) break;
    }
  } finally {
    await worker.terminate();
  }

  const best = passResults.sort((left, right) => right.score - left.score)[0];
  const bestText = best?.text || "";
  const draft = parseBillText(bestText);
  const warnings = buildWarnings(bestText, draft, passResults);

  options.onProgress?.({ status: "Draft ready", progress: 1, passName: best?.name });

  return {
    text: bestText,
    confidence: Math.round(best?.confidence || 0),
    draft,
    passes: passResults.map(({ name, confidence, score, textLength }) => ({
      name,
      confidence: Math.round(confidence),
      score: Math.round(score),
      textLength
    })),
    warnings
  };
}

function normalizeOcrText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[|]{2,}/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\bRs\s*[:.-]/gi, "Rs ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getCleanLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\r\n]+/g, " ").trim())
    .filter((line) => line.length > 1);
}

function extractNumbers(line: string): NumberToken[] {
  const values: NumberToken[] = [];
  for (const match of line.matchAll(rupeeAmount)) {
    const raw = match[1] || "";
    const value = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    values.push({ value, raw, line, index: match.index || 0 });
  }
  return values;
}

function isLikelyIdentifier(token: NumberToken) {
  const digits = token.raw.replace(/\D/g, "");
  if (digits.length >= 10 && !token.raw.includes(".") && !token.raw.includes(",")) return true;
  if (/\b(gstin|gstin:|gst|pan|hsn|sac|phone|mobile|contact|invoice\s*no|bill\s*no)\b/i.test(token.line)) {
    return digits.length > 5;
  }
  if (/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(token.line) && token.value <= 31) return true;
  return false;
}

function plausibleAmount(token: NumberToken) {
  if (isLikelyIdentifier(token)) return false;
  if (/%/.test(token.line) && token.value <= 100) return false;
  if (token.value <= 0 || token.value > 100_000_000) return false;
  return true;
}

function extractTotal(lines: string[]) {
  const priorityPatterns = [
    /\bgrand\s*total\b/i,
    /\bnet\s*(amount|total)\b/i,
    /\btotal\s*(amount|value|payable|due)\b/i,
    /\binvoice\s*(amount|value|total)\b/i,
    /\bamount\s*(payable|due)\b/i,
    /\bbalance\s*due\b/i
  ];

  for (const pattern of priorityPatterns) {
    const line = [...lines].reverse().find((entry) => pattern.test(entry));
    const numbers = line ? extractNumbers(line).filter(plausibleAmount) : [];
    if (numbers.length) return Math.max(...numbers.map((item) => item.value));
  }

  const candidates = lines
    .filter((line) => !/\b(gstin|phone|mobile|contact|pan|hsn|sac|invoice\s*no|bill\s*no)\b/i.test(line))
    .flatMap(extractNumbers)
    .filter(plausibleAmount)
    .filter((token) => token.value >= 10);

  return candidates.length ? Math.max(...candidates.map((item) => item.value)) : 0;
}

function extractMaterial(text: string) {
  const match = materialPatterns.find((item) => item.pattern.test(text));
  return { name: match?.name || "", unit: match?.unit || "" };
}

function extractUnit(text: string) {
  return unitPatterns.find((item) => item.pattern.test(text))?.unit || "";
}

function extractQuantity(text: string) {
  const unitPattern = unitPatterns.map((item) => item.pattern.source).join("|");
  const match = text.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(?:${unitPattern})`, "i"));
  return match?.[1] ? Number(match[1]) : 0;
}

function extractRate(text: string) {
  const match = text.match(/\b(?:rate|price|@|at|each)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
  return match?.[1] ? Number(match[1]) : 0;
}

function extractItem(lines: string[], total: number) {
  const ignored = /\b(total|subtotal|gst|tax|cgst|sgst|igst|round|balance|invoice|bill\s*no|date|phone|mobile|pan|gstin)\b/i;
  const scored = lines
    .filter((line) => !ignored.test(line))
    .map((line) => {
      const material = extractMaterial(line);
      const unit = extractUnit(line);
      const numbers = extractNumbers(line).filter(plausibleAmount);
      const score = (material.name ? 4 : 0) + (unit ? 2 : 0) + Math.min(numbers.length, 3);
      return { line, material, unit, numbers, score };
    })
    .filter((item) => item.score >= 3)
    .sort((left, right) => right.score - left.score || right.numbers.length - left.numbers.length);

  const best = scored[0];
  if (!best) return { materialName: "", quantity: 0, rate: 0, unit: "" };

  const numbers = best.numbers.map((item) => item.value);
  const lineTotal = total ? numbers.find((value) => Math.abs(value - total) < 1) || numbers[numbers.length - 1] || 0 : numbers[numbers.length - 1] || 0;
  const quantity = numbers.find((value) => value > 0 && value < 100_000 && value !== lineTotal) || 0;
  const rate =
    numbers.find((value) => value > 0 && value !== quantity && value !== lineTotal) ||
    (quantity && lineTotal ? lineTotal / quantity : 0);

  return {
    materialName: best.material.name || cleanMaterialName(best.line),
    quantity,
    rate,
    unit: best.unit || best.material.unit
  };
}

function cleanMaterialName(line: string) {
  const cleaned = line
    .replace(rupeeAmount, " ")
    .replace(/\b(qty|quantity|rate|amount|price|nos?|bags?|kgs?|tons?|sqft|rft|box(?:es)?|lit(?:re|er)?s?)\b/gi, " ")
    .replace(/[^a-z0-9 .&/-]/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.slice(0, 60);
}

function extractSupplier(lines: string[]) {
  const businessLine = lines.find((line) =>
    /\b(enterprise|enterprises|traders|supplier|hardware|cement|steel|store|agency|mart|depot|distributor|corporation|company|co\.|and co|associates)\b/i.test(line)
  );
  if (businessLine) return cleanSupplierLine(businessLine);

  const firstMeaningful = lines.find((line) => {
    if (line.length < 4 || line.length > 90) return false;
    if (/\b(tax invoice|invoice|bill|date|gstin|phone|mobile|total|amount|qty|rate|original|duplicate|cash memo)\b/i.test(line)) return false;
    if (extractNumbers(line).length > 2) return false;
    return /[a-z]/i.test(line);
  });

  return firstMeaningful ? cleanSupplierLine(firstMeaningful) : "";
}

function cleanSupplierLine(line: string) {
  return line
    .replace(/\b(tax invoice|invoice|bill of supply|cash memo)\b/gi, " ")
    .replace(/[^a-z0-9 .&/-]/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractMobile(text: string) {
  const match = text.match(/(?:\+91[\s-]?)?[6-9]\d[\d\s-]{8,12}/);
  return match ? match[0].replace(/[^\d+]/g, "").slice(-10) : "";
}

function extractGstNumber(text: string) {
  const match = text.toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/);
  return match?.[0] || "";
}

function extractBillNumber(lines: string[]) {
  const line = lines.find((entry) => /\b(invoice|inv|bill|receipt|challan)\s*(no|number|#|:)?\b/i.test(entry));
  if (!line) return "";
  const match = line.match(/\b(?:invoice|inv|bill|receipt|challan)\s*(?:no|number|#|:)?\s*[:#-]?\s*([a-z0-9/-]{2,24})\b/i);
  return match?.[1]?.replace(/[.,;]$/, "") || "";
}

function normalizeDate(text: string) {
  const iso = text.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (iso) {
    const year = iso[1] || "";
    const month = (iso[2] || "").padStart(2, "0");
    const day = (iso[3] || "").padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const numeric = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (numeric) {
    const [, rawDay = "", rawMonth = "", rawYear = ""] = numeric;
    const day = rawDay.padStart(2, "0");
    const month = rawMonth.padStart(2, "0");
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }

  const named = text.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(20\d{2}|\d{2})\b/i);
  if (named) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const day = (named[1] || "").padStart(2, "0");
    const month = String(months.indexOf((named[2] || "").slice(0, 3).toLowerCase()) + 1).padStart(2, "0");
    const rawYear = named[3] || "";
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    if (month !== "00") return `${year}-${month}-${day}`;
  }

  return todayIso();
}

function scoreOcrText(text: string, confidence: number) {
  const lines = getCleanLines(text);
  const hasTotal = extractTotal(lines) > 0;
  const hasSupplier = Boolean(extractSupplier(lines));
  const hasDate = normalizeDate(text) !== todayIso();
  const hasMaterial = Boolean(extractMaterial(text).name);
  const hasGst = Boolean(extractGstNumber(text));
  const lengthScore = Math.min(22, text.trim().length / 20);
  return Math.min(100, confidence * 0.48 + lengthScore + (hasTotal ? 14 : 0) + (hasSupplier ? 8 : 0) + (hasDate ? 6 : 0) + (hasMaterial ? 5 : 0) + (hasGst ? 4 : 0));
}

function buildWarnings(text: string, draft: Partial<BillOcrDraft>, passes: BillOcrPass[]) {
  const warnings: string[] = [];
  if (!text.trim()) warnings.push("No readable text found. Take the photo closer and avoid glare.");
  if (!draft.total || Number(draft.total) <= 0) warnings.push("Total amount was not detected. Enter it manually before saving.");
  if (!draft.supplier_name) warnings.push("Supplier name was not clear.");
  if (!draft.material_name) warnings.push("Material name was not clear.");
  if (!draft.bill_number) warnings.push("Bill number was not detected.");
  if (passes.length > 1) warnings.push("Multiple OCR passes were used because the first read was weak.");
  return warnings;
}

async function createOcrVariants(file: File): Promise<OcrVariant[]> {
  const image = await loadImageSource(file);
  try {
    const normalized = createCanvasFromImage(image, 2200);
    const enhanced = transformCanvas(normalized, "enhanced");
    const binary = transformCanvas(normalized, "binary");

    return [
      { name: "enhanced", image: await canvasToBlob(enhanced), psm: "4" },
      { name: "table-text", image: await canvasToBlob(binary), psm: "6" },
      { name: "raw-fallback", image: await canvasToBlob(normalized), psm: "11" }
    ];
  } finally {
    if ("close" in image && typeof image.close === "function") image.close();
  }
}

function loadImageSource(file: File): Promise<HTMLImageElement | ImageBitmap> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => loadHtmlImage(file));
  }
  return loadHtmlImage(file);
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this photo"));
    };
    image.src = url;
  });
}

function sourceSize(source: HTMLImageElement | ImageBitmap) {
  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height
    };
  }
  return { width: source.width, height: source.height };
}

function createCanvasFromImage(source: HTMLImageElement | ImageBitmap, maxLongEdge: number) {
  const size = sourceSize(source);
  const longEdge = Math.max(size.width, size.height);
  const scale = Math.min(2.2, longEdge < 1200 ? 1500 / longEdge : maxLongEdge / longEdge, 1.4);
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not prepare scanner image");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function transformCanvas(source: HTMLCanvasElement, mode: "enhanced" | "binary") {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not enhance scanner image");
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] || 0;
    const green = data[index + 1] || 0;
    const blue = data[index + 2] || 0;
    let gray = red * 0.299 + green * 0.587 + blue * 0.114;
    gray = clamp((gray - 128) * (mode === "binary" ? 1.72 : 1.38) + (mode === "binary" ? 142 : 134), 0, 255);
    const value = mode === "binary" ? (gray > 162 ? 255 : 0) : gray;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not prepare OCR image"));
    }, "image/png");
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
