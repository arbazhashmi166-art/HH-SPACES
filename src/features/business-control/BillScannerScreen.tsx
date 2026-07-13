"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastMessage } from "@/components/ui/toast-message";
import { useAuth } from "@/lib/auth";
import { createRecord, useCreateRecord, useRecords } from "@/lib/repository";
import { scanBillWithAi } from "@/services/ai-bill-ocr";
import { scanBillImage, type BillOcrPass } from "@/services/bill-ocr";
import { createBillPhotoReference } from "@/services/photo-storage";
import { formatMoney, todayIso } from "@/utils/format";
import styles from "./BusinessControl.module.css";

type BillDraft = {
  site_id: string;
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

const units = ["Bag", "Kg", "Ton", "Sqft", "RFT", "Nos", "Box", "Litre"];

function blankDraft(): BillDraft {
  return {
    site_id: "",
    date: todayIso(),
    supplier_name: "",
    supplier_mobile: "",
    bill_number: "",
    gst_number: "",
    material_name: "",
    quantity: "1",
    unit: "Nos",
    rate: "0",
    total: "0",
    notes: ""
  };
}

export function BillScannerScreen() {
  const { company, user, session, offlineMode } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [draft, setDraft] = useState<BillDraft>(() => blankDraft());
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("Ready");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanConfidence, setScanConfidence] = useState<number | null>(null);
  const [scanPasses, setScanPasses] = useState<BillOcrPass[]>([]);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
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
  const canUseAiOcr = Boolean(session && !offlineMode);

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
    setScanConfidence(null);
    setScanPasses([]);
    setScanWarnings([]);
    setScanStatus("Photo ready");
    setScanProgress(0);
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

  const applyScanResult = (result: Awaited<ReturnType<typeof scanBillImage>>, successMessage: string) => {
    const text = result.text || "";
    setOcrText(text);
    setScanConfidence(result.confidence);
    setScanPasses(result.passes);
    setScanWarnings(result.warnings);
    setDraft((current) => ({ ...current, ...result.draft }));
    setToast(text.trim() ? successMessage : "Scan finished, but text was not clear.");
  };

  const scanLocal = async () => {
    if (!file) {
      setToast("Choose or capture a bill photo first");
      return;
    }
    setScanning(true);
    setScanStatus("Preparing bill photo");
    setScanProgress(0.04);
    setScanWarnings([]);
    try {
      const result = await scanBillImage(file, {
        onProgress: (progress) => {
          setScanStatus(progress.passName ? `${progress.status} (${progress.passName})` : progress.status);
          setScanProgress(progress.progress);
        }
      });
      applyScanResult(result, "Local OCR finished. Check the draft before saving.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not scan this bill");
      setScanStatus("Scan failed");
    } finally {
      setScanProgress(0);
      setScanning(false);
    }
  };

  const scanAi = async () => {
    if (!file) {
      setToast("Choose or capture a bill photo first");
      return;
    }
    if (!canUseAiOcr) {
      setToast("Login with Supabase cloud sync to use AI OCR. Use Local Scan for this device.");
      return;
    }
    setScanning(true);
    setScanStatus("AI Vision reading bill");
    setScanProgress(0.18);
    setScanWarnings([]);
    try {
      const result = await scanBillWithAi(file, ocrText);
      setScanStatus(result.model ? `AI OCR complete (${result.model})` : "AI OCR complete");
      setScanProgress(1);
      applyScanResult(result, "AI OCR finished. Check every amount before saving.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI OCR failed";
      setToast(`${message}. Running local OCR backup.`);
      const fallback = await scanBillImage(file, {
        onProgress: (progress) => {
          setScanStatus(progress.passName ? `Backup ${progress.status} (${progress.passName})` : `Backup ${progress.status}`);
          setScanProgress(progress.progress);
        }
      });
      applyScanResult(fallback, "AI was unavailable, so local OCR backup prepared the draft.");
    } finally {
      setScanProgress(0);
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
        supplier_mobile: draft.supplier_mobile || null,
        bill_number: draft.bill_number || null,
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
        notes: `${draft.supplier_name || "Bill"} ${draft.material_name || "expense"}${draft.bill_number ? `\nBill No: ${draft.bill_number}` : ""}${draft.gst_number ? `\nGSTIN: ${draft.gst_number}` : ""}${draft.notes ? `\n${draft.notes}` : ""}`,
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
        <p>Capture a supplier bill, clean the image, run smart OCR, then save it as material or expense after checking the draft.</p>
        <div className={styles.scanMeta}>
          <span>{scanStatus}</span>
          <strong>{scanConfidence === null ? "OCR ready" : `${scanConfidence}% confidence`}</strong>
        </div>
        {scanning ? <div className={styles.progressTrack}><span style={{ width: `${Math.round(scanProgress * 100)}%` }} /></div> : null}
        <div className={styles.heroActions}>
          <Button onClick={scanAi} disabled={scanning}>{scanning ? "Scanning..." : "AI Scan"}</Button>
          <Button variant="secondary" onClick={scanLocal} disabled={scanning}>{scanning ? "Scanning..." : "Local Scan"}</Button>
        </div>
        <div className={styles.heroActions}>
          <Button variant="secondary" onClick={() => { setDraft(blankDraft()); setFile(null); setOcrText(""); setScanConfidence(null); setScanPasses([]); setScanWarnings([]); setScanStatus("Ready"); }}>Reset</Button>
          <Button variant="secondary" onClick={() => browseInputRef.current?.click()}>Choose Photo</Button>
        </div>
        <p className={styles.aiOcrNotice}>AI Scan uses OpenAI Vision securely from Supabase Edge Function. Local Scan works without AI as backup.</p>
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
          <input className={styles.input} value={draft.supplier_mobile} onChange={(event) => updateDraft("supplier_mobile", event.target.value)} placeholder="Supplier mobile" />
          <div className={styles.grid}>
            <input className={styles.input} value={draft.bill_number} onChange={(event) => updateDraft("bill_number", event.target.value)} placeholder="Bill / invoice number" />
            <input className={styles.input} value={draft.gst_number} onChange={(event) => updateDraft("gst_number", event.target.value)} placeholder="GSTIN" />
          </div>
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
        {scanPasses.length ? (
          <div className={styles.scanPasses}>
            {scanPasses.map((pass) => (
              <span key={pass.name}>{pass.name}: {pass.score}/100</span>
            ))}
          </div>
        ) : null}
        {scanWarnings.length ? (
          <div className={styles.warningList}>
            {scanWarnings.map((warning) => <span key={warning}>{warning}</span>)}
          </div>
        ) : null}
        {ocrText ? <pre className={styles.ocrText}>{ocrText}</pre> : <EmptyState title="No scanned text yet" description="Tap Scan Bill after selecting a photo." />}
      </Card>

      <ToastMessage message={toast} duration={2600} onDismiss={() => setToast(null)} />
    </section>
  );
}
