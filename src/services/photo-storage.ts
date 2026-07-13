"use client";

import { createId } from "@/lib/id";
import { supabase } from "@/lib/supabase";

type BillPhotoOptions = {
  companyId: string;
  folder: "bills" | "receipts";
  canUseCloud: boolean;
};

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  return "jpg";
}

async function compressImage(file: File) {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) return file;
  if (typeof createImageBitmap === "undefined") return file;
  const bitmap = await createImageBitmap(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  bitmap.close?.();
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read photo"));
    reader.readAsDataURL(file);
  });
}

export async function createBillPhotoReference(file: File | null, options: BillPhotoOptions) {
  if (!file) return null;
  const compressed = await compressImage(file);

  if (options.canUseCloud && supabase && navigator.onLine) {
    const extension = extensionFor(compressed);
    const path = `${options.companyId}/${options.folder}/${createId("photo")}.${extension}`;
    const { error } = await supabase.storage.from("site-photos").upload(path, compressed, {
      contentType: compressed.type || "image/jpeg",
      upsert: false
    });
    if (!error) return `site-photos/${path}`;
  }

  return fileToDataUrl(compressed);
}
