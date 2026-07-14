"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastMessage } from "@/components/ui/toast-message";
import { useAuth } from "@/lib/auth";
import { useCreateRecord, useRecords } from "@/lib/repository";
import { useUiStore } from "@/lib/ui-store";
import { formatMoney, todayIso } from "@/utils/format";
import styles from "./BusinessControl.module.css";

type Checks = {
  attendance_done: boolean;
  material_done: boolean;
  expense_done: boolean;
  progress_done: boolean;
  client_followup_done: boolean;
};

const labels: Array<{ key: keyof Checks; title: string; description: string }> = [
  { key: "attendance_done", title: "Attendance entered", description: "Labour present, absent, half day, and overtime are recorded." },
  { key: "material_done", title: "Material entered", description: "Today material purchase or usage is recorded." },
  { key: "expense_done", title: "Expenses entered", description: "Transport, food, equipment, and misc expenses are recorded." },
  { key: "progress_done", title: "Progress update added", description: "Site progress notes/photos are updated." },
  { key: "client_followup_done", title: "Client follow-up checked", description: "Pending payment follow-up is reviewed." }
];

export function DailyClosingScreen() {
  const { company, user } = useAuth();
  const globalSiteId = useUiStore((state) => state.selectedSiteId);
  const setGlobalSiteId = useUiStore((state) => state.setSelectedSiteId);
  const [selectedSite, setSelectedSite] = useState(globalSiteId);
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const sites = useRecords("sites", company?.id);
  const attendance = useRecords("attendance", company?.id);
  const materials = useRecords("materials", company?.id);
  const expenses = useRecords("expenses", company?.id);
  const progress = useRecords("progress_updates", company?.id);
  const payments = useRecords("client_payments", company?.id);
  const closings = useRecords("daily_closings", company?.id);
  const createClosing = useCreateRecord("daily_closings", company?.id);
  const today = todayIso();

  const autoChecks = useMemo<Checks>(() => {
    const siteMatch = (siteId: string | null | undefined) => !selectedSite || siteId === selectedSite;
    return {
      attendance_done: (attendance.data || []).some((row) => row.date === today && siteMatch(row.site_id)),
      material_done: (materials.data || []).some((row) => row.date === today && siteMatch(row.site_id)),
      expense_done: (expenses.data || []).some((row) => row.date === today && siteMatch(row.site_id)),
      progress_done: (progress.data || []).some((row) => row.date === today && siteMatch(row.site_id)),
      client_followup_done: (payments.data || []).filter((row) => siteMatch(row.site_id)).every((row) => Number(row.pending_amount || 0) <= 0)
    };
  }, [attendance.data, expenses.data, materials.data, payments.data, progress.data, selectedSite, today]);

  const [checks, setChecks] = useState<Checks>(autoChecks);

  useEffect(() => {
    setChecks(autoChecks);
  }, [autoChecks]);

  useEffect(() => {
    setSelectedSite(globalSiteId);
  }, [globalSiteId]);

  const selectedSiteName = sites.data?.find((site) => site.id === selectedSite)?.name || "All Sites";
  const todayAttendance = (attendance.data || []).filter((row) => row.date === today && (!selectedSite || row.site_id === selectedSite));
  const todayMaterial = (materials.data || []).filter((row) => row.date === today && (!selectedSite || row.site_id === selectedSite));
  const todayExpenses = (expenses.data || []).filter((row) => row.date === today && (!selectedSite || row.site_id === selectedSite));
  const todayProgress = (progress.data || []).filter((row) => row.date === today && (!selectedSite || row.site_id === selectedSite));
  const pendingPayment = (payments.data || [])
    .filter((row) => !selectedSite || row.site_id === selectedSite)
    .reduce((sum, row) => sum + Number(row.pending_amount || 0), 0);
  const doneCount = Object.values(checks).filter(Boolean).length;

  const reportText = [
    `Daily Closing - ${today}`,
    `Scope: ${selectedSiteName}`,
    `Attendance entries: ${todayAttendance.length}`,
    `Material entries: ${todayMaterial.length} (${formatMoney(todayMaterial.reduce((sum, row) => sum + Number(row.total || 0), 0))})`,
    `Expense entries: ${todayExpenses.length} (${formatMoney(todayExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0))})`,
    `Progress updates: ${todayProgress.length}`,
    `Pending client payment: ${formatMoney(pendingPayment)}`,
    `Checklist completed: ${doneCount}/5`,
    notes ? `Notes: ${notes}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const toggle = (key: keyof Checks) => setChecks((current) => ({ ...current, [key]: !current[key] }));
  const changeSite = (siteId: string) => {
    setSelectedSite(siteId);
    setGlobalSiteId(siteId);
  };

  const saveClosing = async () => {
    await createClosing.mutateAsync({
      values: {
        site_id: selectedSite || null,
        date: today,
        ...checks,
        report_text: reportText,
        notes: notes || null
      },
      userId: user?.id || null,
      source: "manual"
    });
    setToast("Daily closing saved");
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard?.writeText(reportText);
      setCopyStatus("Daily report copied. You can paste it into WhatsApp or message.");
      setToast("Report copied");
    } catch {
      setCopyStatus("Copy was blocked by the browser. Select the report text below and copy manually.");
      setToast("Copy blocked");
    }
  };

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>Smart Daily Closing</span>
        <h2>{doneCount}/5</h2>
        <p>Close the day with attendance, material, expense, progress, and payment follow-up checked.</p>
        <div className={styles.heroActions}>
          <Button onClick={saveClosing} disabled={createClosing.isPending}>Save Closing</Button>
          <Button variant="secondary" onClick={copyReport}>Copy Report</Button>
        </div>
      </div>

      {copyStatus ? <div className={styles.reportBox}>{copyStatus}</div> : null}

      <Card>
        <CardHeader title="Closing Scope" subtitle="Choose one site or close the full company day." />
        <div className={styles.fieldGrid}>
          <select className={styles.select} value={selectedSite} onChange={(event) => changeSite(event.target.value)}>
            <option value="">All Sites</option>
            {(sites.data || []).map((site) => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
          <textarea className={styles.textarea} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Closing notes, problems, next action..." />
        </div>
      </Card>

      <Card>
        <CardHeader title="Checklist" subtitle="Tap any item to mark it manually if you checked it outside the app." />
        <div className={styles.closingList}>
          {labels.map((item) => (
            <button
              className={`${styles.closingItem} ${checks[item.key] ? styles.closingItemDone : ""}`}
              key={item.key}
              type="button"
              onClick={() => toggle(item.key)}
            >
              <span>{checks[item.key] ? "Done" : "Pending"}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Generated Daily Report" subtitle="This is saved with the closing and can be copied to WhatsApp." action={<Badge tone={doneCount === 5 ? "success" : "warning"}>{doneCount}/5</Badge>} />
        <div className={styles.reportBox}>{reportText}</div>
      </Card>

      <Card>
        <CardHeader title="Previous Closings" subtitle="Audit-friendly history of daily closing reports." />
        {(closings.data || []).length ? (
          <div className={styles.closingList}>
            {(closings.data || []).slice(0, 6).map((closing) => (
              <div className={styles.recoveryItem} key={closing.id}>
                <div className={styles.itemTop}>
                  <div>
                    <h3>{closing.date}</h3>
                    <p>{sites.data?.find((site) => site.id === closing.site_id)?.name || "All Sites"}</p>
                  </div>
                  <Badge tone={Object.values({
                    attendance_done: closing.attendance_done,
                    material_done: closing.material_done,
                    expense_done: closing.expense_done,
                    progress_done: closing.progress_done,
                    client_followup_done: closing.client_followup_done
                  }).filter(Boolean).length === 5 ? "success" : "warning"}>
                    {Object.values({
                      attendance_done: closing.attendance_done,
                      material_done: closing.material_done,
                      expense_done: closing.expense_done,
                      progress_done: closing.progress_done,
                      client_followup_done: closing.client_followup_done
                    }).filter(Boolean).length}/5
                  </Badge>
                </div>
                <p>{closing.notes || "No notes"}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No daily closing saved" description="Save today’s closing to build a daily operating history." />
        )}
      </Card>

      <ToastMessage message={toast} duration={2400} onDismiss={() => setToast(null)} />
    </section>
  );
}
