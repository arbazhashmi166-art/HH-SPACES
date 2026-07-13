"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { automationEngine } from "@/utils/automation-engine";
import { formatMoney } from "@/utils/format";
import styles from "./BusinessControl.module.css";

export function CashFlowForecastScreen() {
  const router = useRouter();
  const { company } = useAuth();
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

  const forecast = [7, 15, 30].map((days) => {
    const receiptRatio = days === 7 ? 0.35 : days === 15 ? 0.6 : 0.85;
    const payableRatio = days === 7 ? 0.45 : days === 15 ? 0.7 : 1;
    const expectedIn = Math.round(engine.cashflow.pendingClient * receiptRatio + engine.cashflow.unbilledExtraWorks * (days === 30 ? 0.5 : 0.2));
    const expectedOut = Math.round(
      engine.cashflow.averageDailyBurn * days +
        engine.cashflow.supplierExposure * payableRatio +
        engine.cashflow.labourBalance * (days >= 15 ? 1 : 0.5)
    );
    return {
      days,
      expectedIn,
      expectedOut,
      net: expectedIn - expectedOut,
      coverage: expectedOut > 0 ? Math.min(100, Math.round((expectedIn / expectedOut) * 100)) : 100
    };
  });
  const danger = forecast.find((item) => item.net < 0);

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>Cash Flow Forecast</span>
        <h2>{danger ? `${danger.days} days` : "Stable"}</h2>
        <p>{danger ? `Cash pressure can become negative within ${danger.days} days if collections do not happen.` : "Expected collections cover forecast payables."}</p>
        <div className={styles.heroActions}>
          <Button onClick={() => router.push("/payment-recovery")}>Collect Money</Button>
          <Button variant="secondary" onClick={() => router.push("/supplier-payments")}>Supplier Dues</Button>
        </div>
      </div>

      <div className={styles.grid}>
        <Card className={styles.miniCard}>
          <span>Client Pending</span>
          <strong>{formatMoney(engine.cashflow.pendingClient)}</strong>
          <Badge tone={engine.cashflow.pendingClient ? "warning" : "success"}>Receivable</Badge>
        </Card>
        <Card className={styles.miniCard}>
          <span>Daily Burn</span>
          <strong>{formatMoney(engine.cashflow.averageDailyBurn)}</strong>
          <Badge tone="info">Recent average</Badge>
        </Card>
      </div>

      <Card>
        <CardHeader title="7 / 15 / 30 Day Forecast" subtitle="Expected cash in versus labour, supplier, material, and expense pressure." />
        <div className={styles.smartList}>
          {forecast.map((item) => (
            <div className={styles.smartCard} key={item.days}>
              <div className={styles.itemTop}>
                <div>
                  <strong>Next {item.days} days</strong>
                  <p>In {formatMoney(item.expectedIn)} | Out {formatMoney(item.expectedOut)}</p>
                </div>
                <Badge tone={item.net < 0 ? "danger" : item.net < item.expectedOut * 0.2 ? "warning" : "success"}>{formatMoney(item.net)}</Badge>
              </div>
              <div className={styles.forecastBar}>
                <span style={{ width: `${item.coverage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Pressure Breakdown" subtitle="These numbers drive the forecast." />
        <div className={styles.grid}>
          <div className={styles.miniCard}><span>Supplier Exposure</span><strong>{formatMoney(engine.cashflow.supplierExposure)}</strong></div>
          <div className={styles.miniCard}><span>Labour Balance</span><strong>{formatMoney(engine.cashflow.labourBalance)}</strong></div>
          <div className={styles.miniCard}><span>Unbilled Extra</span><strong>{formatMoney(engine.cashflow.unbilledExtraWorks)}</strong></div>
          <div className={styles.miniCard}><span>Net After Payables</span><strong>{formatMoney(engine.cashflow.netToCollectAfterPayables)}</strong></div>
        </div>
      </Card>
    </section>
  );
}
