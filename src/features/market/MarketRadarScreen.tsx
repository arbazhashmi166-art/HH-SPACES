"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { marketRadar, type MarketCapabilityStatus } from "@/utils/market-radar";
import styles from "./MarketRadarScreen.module.css";

function tone(status: MarketCapabilityStatus) {
  if (status === "active") return "success";
  if (status === "partial") return "warning";
  return "neutral";
}

export function MarketRadarScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const sites = useRecords("sites", company?.id);
  const labour = useRecords("labour", company?.id);
  const attendance = useRecords("attendance", company?.id);
  const materials = useRecords("materials", company?.id);
  const suppliers = useRecords("suppliers", company?.id);
  const expenses = useRecords("expenses", company?.id);
  const payments = useRecords("client_payments", company?.id);
  const supplierPayments = useRecords("supplier_payments", company?.id);
  const progress = useRecords("progress_updates", company?.id);
  const progressPhotos = useRecords("progress_photos", company?.id);
  const reminders = useRecords("reminders", company?.id);
  const aiMessages = useRecords("ai_messages", company?.id);

  const radar = useMemo(
    () =>
      marketRadar({
        sites: sites.data || [],
        labour: labour.data || [],
        attendance: attendance.data || [],
        materials: materials.data || [],
        suppliers: suppliers.data || [],
        expenses: expenses.data || [],
        payments: payments.data || [],
        supplierPayments: supplierPayments.data || [],
        progress: progress.data || [],
        progressPhotos: progressPhotos.data || [],
        reminders: reminders.data || [],
        aiMessages: aiMessages.data || []
      }),
    [
      aiMessages.data,
      attendance.data,
      expenses.data,
      labour.data,
      materials.data,
      payments.data,
      progress.data,
      progressPhotos.data,
      reminders.data,
      sites.data,
      supplierPayments.data,
      suppliers.data
    ]
  );

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>Market Upgrade Radar</span>
        <h2>{radar.marketPowerScore}/100</h2>
        <p>{radar.headline}</p>
      </div>

      <Card>
        <CardHeader title="What The Market Is Moving Toward" subtitle="AI project intelligence, mobile field data, photo proof, procurement control, cashflow automation, and client-ready reporting." />
      </Card>

      <Card>
        <CardHeader title="Upgrade Priorities" subtitle="Lowest score appears first so you know exactly what to strengthen next." />
        <div className={styles.capabilityList}>
          {radar.capabilities.map((item) => (
            <div className={styles.capability} key={item.id}>
              <div className={styles.capabilityTop}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.businessValue}</p>
                </div>
                <div className={styles.scorePill}>{item.powerScore}</div>
              </div>
              <div className={styles.signal}>
                <span>Market signal</span>
                <p>{item.marketSignal}</p>
              </div>
              <div className={styles.actionRow}>
                <Badge tone={tone(item.status)}>{item.status}</Badge>
                <Button variant="secondary" onClick={() => router.push(item.route)}>
                  {item.actionLabel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Business Playbook" subtitle="Simple operating rhythm for running the business like a modern site command center." />
        <div className={styles.playbook}>
          {radar.playbook.map((item) => (
            <button className={styles.playbookItem} key={item.title} type="button" onClick={() => router.push(item.route)}>
              <span>{item.cadence}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </button>
          ))}
        </div>
      </Card>
    </section>
  );
}
