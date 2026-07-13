"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { automationEngine } from "@/utils/automation-engine";
import { businessIntelligence } from "@/utils/business-logic";
import { dashboardMetrics } from "@/utils/calc";
import { formatMoney } from "@/utils/format";
import styles from "./BusinessControl.module.css";

function tone(severity: "info" | "warning" | "critical") {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

export function BusinessBrainScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const sites = useRecords("sites", company?.id);
  const labour = useRecords("labour", company?.id);
  const attendance = useRecords("attendance", company?.id);
  const materials = useRecords("materials", company?.id);
  const expenses = useRecords("expenses", company?.id);
  const payments = useRecords("client_payments", company?.id);
  const supplierPayments = useRecords("supplier_payments", company?.id);
  const partnerDraws = useRecords("partner_draws", company?.id);
  const progress = useRecords("progress_updates", company?.id);
  const extraWorks = useRecords("extra_works", company?.id);
  const reminders = useRecords("reminders", company?.id);
  const approvals = useRecords("approval_requests", company?.id);

  const metrics = dashboardMetrics({
    sites: sites.data || [],
    attendance: attendance.data || [],
    materials: materials.data || [],
    expenses: expenses.data || [],
    payments: payments.data || [],
    supplierPayments: supplierPayments.data || [],
    labour: labour.data || [],
    extraWorks: extraWorks.data || [],
    partnerDraws: partnerDraws.data || []
  });

  const intelligence = useMemo(
    () =>
      businessIntelligence({
        sites: sites.data || [],
        attendance: attendance.data || [],
        materials: materials.data || [],
        expenses: expenses.data || [],
        payments: payments.data || [],
        supplierPayments: supplierPayments.data || [],
        progress: progress.data || [],
        extraWorks: extraWorks.data || []
      }),
    [attendance.data, expenses.data, extraWorks.data, materials.data, payments.data, progress.data, sites.data, supplierPayments.data]
  );

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

  const pendingApprovals = (approvals.data || []).filter((item) => item.status === "pending");
  const partnerLeader = Object.entries(
    (partnerDraws.data || []).reduce<Record<string, number>>((acc, row) => {
      acc[row.partner_name] = (acc[row.partner_name] || 0) + Number(row.amount || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  const brainCards = [
    {
      title: "First money action",
      value: engine.actions.find((item) => item.category === "money")?.title || "No urgent collection",
      detail: engine.actions.find((item) => item.category === "money")?.description || "Payment recovery is currently controlled.",
      route: engine.actions.find((item) => item.category === "money")?.route || "/payment-recovery",
      severity: engine.actions.find((item) => item.category === "money")?.severity || "info"
    },
    {
      title: "Highest site risk",
      value: intelligence.siteHealth[0] ? `${intelligence.siteHealth[0].siteName} ${intelligence.siteHealth[0].riskScore}%` : "No risk yet",
      detail: intelligence.siteHealth[0]
        ? `Profit ${formatMoney(intelligence.siteHealth[0].profit)}, pending ${formatMoney(intelligence.siteHealth[0].pendingClient)}.`
        : "Add sites and entries to calculate risk.",
      route: "/data-health",
      severity: intelligence.siteHealth[0]?.riskLevel || "info"
    },
    {
      title: "Approval pressure",
      value: `${pendingApprovals.length} pending approvals`,
      detail: pendingApprovals.length ? `${formatMoney(pendingApprovals.reduce((sum, row) => sum + Number(row.amount || 0), 0))} waiting for decision.` : "No approval is pending.",
      route: "/approval-center",
      severity: pendingApprovals.length ? "warning" : "info"
    },
    {
      title: "Partner cash watch",
      value: partnerLeader ? `${partnerLeader[0]} ${formatMoney(partnerLeader[1])}` : "No partner draw",
      detail: partnerLeader ? "Highest company cash taken by one partner." : "Partner cash ledger is clean.",
      route: "/partner-ledger",
      severity: partnerLeader ? "warning" : "info"
    }
  ] as const;

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>AI Business Brain</span>
        <h2>{engine.operatingScore}/100</h2>
        <p>One control screen for money, site risk, approvals, partner cash, and daily priorities.</p>
        <div className={styles.heroActions}>
          <Button onClick={() => router.push("/cash-flow")}>Cash Forecast</Button>
          <Button variant="secondary" onClick={() => router.push("/approval-center")}>Approvals</Button>
        </div>
      </div>

      <div className={styles.grid}>
        <Card className={styles.miniCard}>
          <span>Pending Client</span>
          <strong>{formatMoney(metrics.pendingClientPayments)}</strong>
          <Badge tone={metrics.pendingClientPayments ? "warning" : "success"}>{metrics.pendingClientPayments ? "Collect" : "Clear"}</Badge>
        </Card>
        <Card className={styles.miniCard}>
          <span>Partner Draws</span>
          <strong>{formatMoney(metrics.partnerDrawsTotal)}</strong>
          <Badge tone="info">Tracked</Badge>
        </Card>
      </div>

      <Card>
        <CardHeader title="Brain Decisions" subtitle="The app reads your records and tells you what needs attention first." />
        <div className={styles.smartList}>
          {brainCards.map((card) => (
            <button className={styles.smartCard} key={card.title} type="button" onClick={() => router.push(card.route)}>
              <div className={styles.itemTop}>
                <div>
                  <strong>{card.title}</strong>
                  <p>{card.value}</p>
                </div>
                <Badge tone={tone(card.severity)}>{card.severity}</Badge>
              </div>
              <p>{card.detail}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Next Best Actions" subtitle="Sorted by business risk and cash impact." />
        <div className={styles.smartList}>
          {engine.actions.slice(0, 6).map((action) => (
            <button className={styles.smartCard} key={action.id} type="button" onClick={() => router.push(action.route)}>
              <div className={styles.itemTop}>
                <strong>{action.title}</strong>
                <Badge tone={tone(action.severity)}>{action.severity}</Badge>
              </div>
              <p>{action.description}</p>
            </button>
          ))}
        </div>
      </Card>
    </section>
  );
}
