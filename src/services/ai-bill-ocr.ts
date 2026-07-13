import { supabase } from "@/lib/supabase";
import type { BillOcrDraft, BillOcrLineItem, BillOcrPass, BillOcrResult } from "@/services/bill-ocr";

type AiBillOcrResponse = {
  draft?: Partial<BillOcrDraft>;
  text?: string;
  confidence?: number;
  warnings?: string[];
  source?: string;
  model?: string;
  items?: Array<Partial<BillOcrLineItem>>;
  raw?: unknown;
  error?: string;
};

export async function scanBillWithAi(file: File, localText = ""): Promise<BillOcrResult & { model?: string; source?: string }> {
  if (!supabase) {
    throw new Error("Supabase cloud is not connected. Login with cloud sync to use AI OCR.");
  }

  const imageDataUrl = await prepareAiImage(file);
  const { data, error } = await supabase.functions.invoke<AiBillOcrResponse>("bill-vision-ocr", {
    body: {
      imageDataUrl,
      fileName: file.name,
      mimeType: "image/jpeg",
      localText
    }
  });

  if (error) throw new Error(error.message || "AI OCR failed");
  if (!data) throw new Error("AI OCR returned no data");
  if (data.error) throw new Error(data.error);

  const pass: BillOcrPass = {
    name: data.model ? `AI ${data.model}` : "AI Vision",
    confidence: Math.round(data.confidence || 0),
    score: Math.round(data.confidence || 0),
    textLength: (data.text || "").trim().length
  };

  return {
    text: data.text || "",
    confidence: Math.round(data.confidence || 0),
    draft: data.draft || {},
    items: normalizeItems(data.items || []),
    passes: [pass],
    warnings: data.warnings || [],
    model: data.model,
    source: data.source
  };
}

function normalizeItems(items: Array<Partial<BillOcrLineItem>>): BillOcrLineItem[] {
  return items
    .map((item) => {
      const quantity = toMoney(item.quantity);
      const rate = toMoney(item.rate);
      const amount = toMoney(item.amount) || quantity * rate;
      return {
        description: String(item.description || "").trim().slice(0, 90),
        quantity: String(quantity || 1),
        unit: String(item.unit || "Nos").trim() || "Nos",
        rate: String(rate),
        amount: String(Math.round(amount * 100) / 100),
        gst_percent: String(toMoney(item.gst_percent)),
        confidence: Math.max(0, Math.min(100, Math.round(Number(item.confidence || 82))))
      };
    })
    .filter((item) => item.description && Number(item.amount) > 0)
    .slice(0, 30);
}

function toMoney(value: unknown) {
  const number = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 0;
}

async function prepareAiImage(file: File) {
  const image = await loadImage(file);
  try {
    const { width, height } = imageSize(image);
    const longEdge = Math.max(width, height);
    const scale = Math.min(1, 1800 / longEdge);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare image for AI OCR");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    if ("close" in image && typeof image.close === "function") image.close();
  }
}

function loadImage(file: File): Promise<HTMLImageElement | ImageBitmap> {
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
      reject(new Error("Could not read this image"));
    };
    image.src = url;
  });
}

function imageSize(image: HTMLImageElement | ImageBitmap) {
  if (image instanceof HTMLImageElement) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height
    };
  }
  return { width: image.width, height: image.height };
}
