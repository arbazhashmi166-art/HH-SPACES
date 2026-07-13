"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastMessage } from "@/components/ui/toast-message";
import { useAuth } from "@/lib/auth";
import { createRecord, useCreateRecord, useRecords } from "@/lib/repository";
import { createBillPhotoReference } from "@/services/photo-storage";
import { formatMoney, todayIso } from "@/utils/format";
import styles from "./BusinessControl.module.css";

type BillDraft = {
  site_id: string;
  date: string;
  supplier_name: string;
  material_name: string;
  quantity: string;
  unit: string;
  rate: string;
  total: string;
  notes: string;
};

const materialWords = ["cement", "sand", "pop", "tile", "paint", "steel", "wire", "waterproof", "brick", "aggregate", "putty", "primer"];
const units = ["Bag", "Kg", "Ton", "Sqft", "RFT", "Nos", "Box", "Litre"];

function blankDraft(): BillDraft {
  return {
    site_id: "",
    date: todayIso(),
    supplier_name: "",
    material_name: "",
    quantity: "1",
    unit: "Nos",
    rate: "0",
    total: "0",
    notes: ""
  };
}

function numberMatches(text: string) {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) || [])
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value));
}

function normalizeDate(text: string) {
  const match = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (!match) return todayIso();
  const [, rawDay = "", rawMonth = "", rawYear = ""] = match;
  const day = rawDay.padStart(2, "0");
  const month = rawMonth.padStart(2, "0");
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month}-${day}`;
}

function parseBillText(text: string): Partial<BillDraft> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lower = text.toLowerCase();
  const totalLine = lines.find((line) => /(grand\s*)?total|net\s*amount|amount\s*due|invoice\s*value/i.test(line));
  const totalNumbers = totalLine ? numberMatches(totalLine) : [];
  const allNumbers = numberMatches(text);
  const total = totalNumbers.length ? Math.max(...totalNumbers) : allNumbers.length ? Math.max(...allNumbers.filter((value) => value < 10_000_000)) : 0;
  const quantityLine = lines.find((line) => /qty|quantity/i.test(line));
  const rateLine = lines.find((line) => /rate|price/i.test(line));
  const quantity = quantityLine ? numberMatches(quantityLine)[0] || 1 : 1;
  const rate = rateLine ? numberMatches(rateLine)[0] || (quantity ? total / quantity : 0) : quantity && total ? total / quantity : 0;
  const material = materialWords.find((word) => lower.includes(word));
  const supplier =
    lines.find((line) => /enterprise|traders|supplier|hardware|cement|steel|store|agency/i.test(line)) ||
    lines.find((line) => /^[a-z0-9 .&-]{4,}$/i.test(line)) ||
    "";

  return {
    date: normalizeDate(text),
    supplier_name: supplier.slice(0, 80),
    material_name: material ? `${material.charAt(0).toUpperCase()}${material.slice(1)}` : "",
    quantity: String(quantity || 1),
    rate: String(Math.round(rate || 0)),
    total: String(Math.round(total || 0)),
    notes: text.slice(0, 900)
  };
}

export function BillScannerScreen() {
  const { company, user, session, offlineMode } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [draft, setDraft] = useState<BillDraft>(() => blankDraft());
  const [scanning, setScanning] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const browseInputRef = useRef<HTMLInputElement | null>(null);

  const sites = useRecords("sites", company?.id);
  const createMaterial = useCreateRecord("materials", company?.id);
  const createExpense = useCreateRecord("expenses", company?.id);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const amount = useMemo(() => Number(draft.total || 0), [draft.total]);
  const canUploadPhoto = Boolean(company?.id && session && !offlineMode);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = "";
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setToast("Select an image bill photo");
      return;
    }
    setFile(selected);
    setOcrText("");
    setToast("Bill photo selected. Tap Scan Bill to read it.");
  };

  const updateDraft = <K extends keyof BillDraft>(key: K, value: BillDraft[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "quantity" || key === "rate") {
        const quantity = Number(key === "quantity" ? value : next.quantity);
        const rate = Number(key === "rate" ? value : next.rate);
        if (Number.isFinite(quantity) && Number.isFinite(rate)) next.total = String(Math.round(quantity * rate));
      }
      return next;
    });
  };

  const scan = async () => {
    if (!file) {
      setToast("Choose or capture a bill photo first");
      return;
    }
    setScanning(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const result = await worker.recognize(file);
      await worker.terminate();
      const text = result.data.text || "";
      setOcrText(text);
      const parsed = parseBillText(text);
      setDraft((current) => ({ ...current, ...parsed }));
      setToast(text.trim() ? "Bill scanned. Check the draft before saving." : "Scan finished, but text was not clear.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not scan this bill");
    } finally {
      setScanning(false);
    }
  };

  const saveMaterial = async () => {
    if (!company?.id) {
      setToast("Company not loaded yet");
      return;
    }
    if (!draft.site_id) {
      setToast("Select site before saving material");
      return;
    }
    if (!draft.material_name.trim() || amount <= 0) {
      setToast("Enter material name and amount");
      return;
    }
    setSavingPhoto(true);
    let billPhotoUrl: string | null = null;
    try {
      billPhotoUrl = await createBillPhotoReference(file, {
        companyId: company.id,
        folder: "bills",
        canUseCloud: canUploadPhoto
      });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not save bill photo");
      setSavingPhoto(false);
      return;
    } finally {
      setSavingPhoto(false);
    }
    const saved = await createMaterial.mutateAsync({
      values: {
        site_id: draft.site_id,
        supplier_id: null,
        date: draft.date,
        material_name: draft.material_name.trim(),
        quantity: Number(draft.quantity || 0),
        unit: draft.unit,
        rate: Number(draft.rate || 0),
        total: amount,
        supplier_name: draft.supplier_name || null,
        supplier_mobile: null,
        bill_number: null,
        bill_photo_url: billPhotoUrl,
        payment_status: "unpaid",
        notes: draft.notes ? `OCR bill scan:\n${draft.notes}` : "Saved from Bill Scanner"
      },
      userId: user?.id || null,
      source: "manual"
    });
    if (company?.id) {
      await createRecord(
        "activity_logs",
        company.id,
        {
          site_id: draft.site_id,
          entity_table: "materials",
          entity_id: saved.id,
          action: "create",
          description: `Material saved from bill scanner: ${draft.material_name}`
        },
        { userId: user?.id || null }
      );
    }
    setToast("Material saved from bill");
  };

  const saveExpense = async () => {
    if (!company?.id) {
      setToast("Company not loaded yet");
      return;
    }
    if (amount <= 0) {
      setToast("Enter expense amount");
      return;
    }
    setSavingPhoto(true);
    let receiptPhotoUrl: string | null = null;
    try {
      receiptPhotoUrl = await createBillPhotoReference(file, {
        companyId: company.id,
        folder: "receipts",
        canUseCloud: canUploadPhoto
      });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not save receipt photo");
      setSavingPhoto(false);
      return;
    } finally {
      setSavingPhoto(false);
    }
    const saved = await createExpense.mutateAsync({
      values: {
        site_id: draft.site_id || null,
        date: draft.date,
        category: "material",
        amount,
        payment_mode: "cash",
        notes: `${draft.supplier_name || "Bill"} ${draft.material_name || "expense"}${draft.notes ? `\n${draft.notes}` : ""}`,
        receipt_photo_url: receiptPhotoUrl
      },
      userId: user?.id || null,
      source: "manual"
    });
    if (company?.id) {
      await createRecord(
        "activity_logs",
        company.id,
        {
          site_id: draft.site_id || null,
          entity_table: "expenses",
          entity_id: saved.id,
          action: "create",
          description: `Expense saved from bill scanner: ${formatMoney(amount)}`
        },
        { userId: user?.id || null }
      );
    }
    setToast("Expense saved from bill");
  };

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>Bill Scanner</span>
        <h2>{formatMoney(amount)}</h2>
        <p>Capture a supplier bill, read text with OCR, then save it as material or expense after checking the draft.</p>
        <div className={styles.heroActions}>
          <Button onClick={scan} disabled={scanning}>{scanning ? "Scanning..." : "Scan Bill"}</Button>
          <Button variant="secondary" onClick={() => { setDraft(blankDraft()); setFile(null); setOcrText(""); }}>Reset</Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Capture Bill" subtitle="Use camera on iPhone/Android or upload a clear bill photo." />
        <div className={styles.fieldGrid}>
          <input ref={cameraInputRef} className={styles.hiddenFileInput} type="file" accept="image/*" capture="environment" onChange={chooseFile} />
          <input ref={browseInputRef} className={styles.hiddenFileInput} type="file" accept="image/*" onChange={chooseFile} />
          <div className={styles.captureActions}>
            <Button type="button" onClick={() => cameraInputRef.current?.click()}>
              Capture Photo
            </Button>
            <Button type="button" variant="secondary" onClick={() => browseInputRef.current?.click()}>
              Browse Image
            </Button>
          </div>
          <div className={styles.photoStatus}>
            <strong>{file ? file.name : "No bill photo selected"}</strong>
            <span>{canUploadPhoto ? "Photo will upload to Supabase Storage when saved." : "Photo will save locally with the entry until cloud sync is available."}</span>
          </div>
          {previewUrl ? <img className={styles.scanPreview} src={previewUrl} alt="Selected bill preview" /> : <EmptyState title="No bill photo selected" description="Take a clear photo with supplier name, date, items, and total visible." />}
        </div>
      </Card>

      <Card>
        <CardHeader title="Editable Draft" subtitle="OCR can make mistakes. Check every amount before saving." />
        <div className={styles.fieldGrid}>
          <select className={styles.select} value={draft.site_id} onChange={(event) => updateDraft("site_id", event.target.value)}>
            <option value="">Select site</option>
            {(sites.data || []).map((site) => (
              <option value={site.id} key={site.id}>{site.name}</option>
            ))}
          </select>
          <input className={styles.input} type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} />
          <input className={styles.input} value={draft.supplier_name} onChange={(event) => updateDraft("supplier_name", event.target.value)} placeholder="Supplier name" />
          <input className={styles.input} value={draft.material_name} onChange={(event) => updateDraft("material_name", event.target.value)} placeholder="Material / expense name" />
          <div className={styles.grid}>
            <input className={styles.input} type="number" inputMode="decimal" value={draft.quantity} onChange={(event) => updateDraft("quantity", event.target.value)} placeholder="Quantity" />
            <select className={styles.select} value={draft.unit} onChange={(event) => updateDraft("unit", event.target.value)}>
              {units.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
            </select>
          </div>
          <div className={styles.grid}>
            <input className={styles.input} type="number" inputMode="decimal" value={draft.rate} onChange={(event) => updateDraft("rate", event.target.value)} placeholder="Rate" />
            <input className={styles.input} type="number" inputMode="decimal" value={draft.total} onChange={(event) => updateDraft("total", event.target.value)} placeholder="Total" />
          </div>
          <textarea className={styles.textarea} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="Notes / OCR text" />
          <div className={styles.buttonRow}>
            <Button onClick={saveMaterial} disabled={createMaterial.isPending || savingPhoto}>{savingPhoto ? "Saving Photo..." : "Save Material"}</Button>
            <Button variant="secondary" onClick={saveExpense} disabled={createExpense.isPending || savingPhoto}>{savingPhoto ? "Saving Photo..." : "Save Expense"}</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="OCR Text" subtitle="Original extracted text is kept here so you can verify the draft." action={<Badge tone={ocrText ? "success" : "neutral"}>{ocrText ? "Read" : "Empty"}</Badge>} />
        {ocrText ? <pre className={styles.ocrText}>{ocrText}</pre> : <EmptyState title="No scanned text yet" description="Tap Scan Bill after selecting a photo." />}
      </Card>

      <ToastMessage message={toast} duration={2600} onDismiss={() => setToast(null)} />
    </section>
  );
}
