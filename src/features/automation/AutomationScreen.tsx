"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastMessage } from "@/components/ui/toast-message";
import { useAuth } from "@/lib/auth";
import { useCreateRecord, useRecords } from "@/lib/repository";
import { automationEngine, nextReminderDate, type AutomationAction } from "@/utils/automation-engine";
import { formatMoney } from "@/utils/format";
import styles from "./AutomationScreen.module.css";

function tone(severity: "info" | "warning" | "critical") {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

export function AutomationScreen() {
  const router = useRouter();
  const { company, user } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const sites = useRecords("sites", company?.id);
  const labour = useRecords("labour", company?.id);
  const attendance = useRecords("attendance", company?.id);
  const materials = useRecords("materials", company?.id);
  const expenses = useRecords("expenses", company?.id);
  const payments = useRecords("client_payments", company?.id);
  const supplierPayments = useRecords("supplier_payments", company?.id);
  const progress = useRecords("progress_updates", company?.id);
  const extraWorks = useRecords("extra_works", company?.id);
  const reminders = useRecords("reminders", company?.id);
  const createReminder = useCreateRecord("reminders", company?.id);

  const engine = useMemo(
    () =>
      automationEngine({
        sites: sites.data || [],
        labour: labour.data || [],
        attendance: attendance.data || [],
        materials: materials.data || [],
        expenses: expenses.data || [],
        payments: payments.data || [],
        supplierPayments: supplierPayments.data || [],
        progress: progress.data || [],
        extraWorks: extraWorks.data || [],
        reminders: reminders.data || []
      }),
    [attendance.data, expenses.data, extraWorks.data, labour.data, materials.data, payments.data, progress.data, reminders.data, sites.data, supplierPayments.data]
  );

  const addReminder = async (action: AutomationAction) => {
    await createReminder.mutateAsync({
      values: {
        site_id: null,
        title: action.reminderTitle || action.title,
        description: action.reminderDescription || action.description,
        due_date: nextReminderDate(),
        status: "open",
        snoozed_until: null
      },
      userId: user?.id || null,
      source: "manual"
    });
    setToast("Reminder created");
  };

  const copyWhatsapp = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setToast("WhatsApp message copied");
    } catch {
      setToast(message);
    }
  };

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <div>
          <span>Business Autopilot</span>
          <h2>{engine.operatingScore}/100</h2>
          <p>{engine.scoreLabel}</p>
        </div>
        <Badge tone={tone(engine.cashflow.pressure)}>{engine.cashflow.pressure} cash pressure</Badge>
      </div>

      <Card>
        <CardHeader title="Cashflow Radar" subtitle="Collect receivables before supplier, labour, and material dues squeeze the business." />
        <div className={styles.cashGrid}>
          <div>
            <span>Client Pending</span>
            <strong>{formatMoney(engine.cashflow.pendingClient)}</strong>
          </div>
          <div>
            <span>Supplier Exposure</span>
            <strong>{formatMoney(engine.cashflow.supplierExposure)}</strong>
          </div>
          <div>
            <span>Labour Balance</span>
            <strong>{formatMoney(engine.cashflow.labourBalance)}</strong>
          </div>
          <div>
            <span>7 Day Labour</span>
            <strong>{formatMoney(engine.cashflow.expectedLabour7Days)}</strong>
          </div>
          <div>
            <span>Unbilled Extra</span>
            <strong>{formatMoney(engine.cashflow.unbilledExtraWorks)}</strong>
          </div>
          <div>
            <span>Daily Burn</span>
            <strong>{formatMoney(engine.cashflow.averageDailyBurn)}</strong>
          </div>
          <div>
            <span>After Payables</span>
            <strong>{formatMoney(engine.cashflow.netToCollectAfterPayables)}</strong>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Next Best Actions" subtitle="Generated from site risk, payments, supplier dues, labour balance, attendance, and progress data." />
        {engine.actions.length ? (
          <div className={styles.actionList}>
            {engine.actions.map((action) => (
              <div className={styles.actionCard} key={action.id}>
                <div className={styles.actionTop}>
                  <div>
                    <strong>{action.title}</strong>
                    <p>{action.description}</p>
                  </div>
                  <Badge tone={tone(action.severity)}>{action.severity}</Badge>
                </div>
                <div className={styles.buttonRow}>
                  <Button onClick={() => router.push(action.route)}>{action.primaryAction}</Button>
                  <Button variant="secondary" onClick={() => addReminder(action)} disabled={createReminder.isPending}>
                    Remind
                  </Button>
                  {action.whatsappMessage ? (
                    <Button variant="ghost" onClick={() => copyWhatsapp(action.whatsappMessage || "")}>
                      WhatsApp
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No automation pressure" description="When payment, attendance, progress, supplier, or budget issues appear, the app will create priority actions here." />
        )}
      </Card>

      <Card>
        <CardHeader title="Daily Closing Checklist" subtitle="Use this before leaving the site or closing the day." />
        <div className={styles.checklist}>
          {engine.checklist.map((item) => (
            <button className={item.done ? styles.doneItem : styles.checkItem} key={item.title} type="button" onClick={() => router.push(item.route)}>
              <span>{item.done ? "Done" : "Open"}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Automation Rules" subtitle="These rules run from your saved data and keep watching the business automatically." />
        <div className={styles.ruleList}>
          {engine.rules.map((rule) => (
            <div className={styles.rule} key={rule.id}>
              <div>
                <strong>{rule.title}</strong>
                <p>{rule.description}</p>
              </div>
              <div className={styles.ruleBadges}>
                <Badge tone={rule.status === "active" ? "success" : rule.status === "watching" ? "info" : "neutral"}>{rule.status}</Badge>
                <Badge tone={tone(rule.severity)}>{rule.severity}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <ToastMessage message={toast} duration={2400} onDismiss={() => setToast(null)} />
    </section>
  );
}
