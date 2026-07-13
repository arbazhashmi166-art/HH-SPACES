"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth";
import { useRecords } from "@/lib/repository";
import { formatMoney, toTitle } from "@/utils/format";
import styles from "./BusinessControl.module.css";

export function PartnerLedgerScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const draws = useRecords("partner_draws", company?.id);
  const sites = useRecords("sites", company?.id);
  const rows = draws.data || [];
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const byPartner = Object.entries(
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.partner_name] = (acc[row.partner_name] || 0) + Number(row.amount || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const equalShare = byPartner.length ? total / byPartner.length : 0;
  const byCategory = Object.entries(
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + Number(row.amount || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>Partner Cash Ledger</span>
        <h2>{formatMoney(total)}</h2>
        <p>Complete register of company money taken by partners for profit share, emergency, advance, salary, and other reasons.</p>
        <div className={styles.heroActions}>
          <Button onClick={() => router.push("/partner-draws?add=1")}>Add Money Taken</Button>
          <Button variant="secondary" onClick={() => router.push("/reports")}>Reports</Button>
        </div>
      </div>

      <div className={styles.grid}>
        <Card className={styles.miniCard}>
          <span>Partners</span>
          <strong>{byPartner.length}</strong>
          <Badge tone="info">Tracked</Badge>
        </Card>
        <Card className={styles.miniCard}>
          <span>Equal Share Marker</span>
          <strong>{formatMoney(equalShare)}</strong>
          <Badge tone="neutral">For comparison</Badge>
        </Card>
      </div>

      <Card>
        <CardHeader title="Partner Totals" subtitle="See who has taken how much from company cash." />
        {byPartner.length ? (
          <div className={styles.ledgerList}>
            {byPartner.map(([name, amount]) => {
              const difference = amount - equalShare;
              return (
                <div className={styles.ledgerCard} key={name}>
                  <div className={styles.ledgerHeader}>
                    <div>
                      <span>{name}</span>
                      <strong>{formatMoney(amount)}</strong>
                    </div>
                    <Badge tone={difference > 0 ? "warning" : difference < 0 ? "info" : "success"}>{difference === 0 ? "Balanced" : difference > 0 ? "Above share" : "Below share"}</Badge>
                  </div>
                  <div className={styles.balanceText}>
                    {difference > 0
                      ? `${name} has taken ${formatMoney(difference)} more than equal share marker.`
                      : difference < 0
                        ? `${name} can still take ${formatMoney(Math.abs(difference))} to match equal share marker.`
                        : `${name} is balanced with the equal share marker.`}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No partner money entries" description="Add each time a partner takes company money. The app will calculate totals automatically." />
        )}
      </Card>

      <Card>
        <CardHeader title="Reason Breakdown" subtitle="Understand why company cash is going out." />
        {byCategory.length ? (
          <div className={styles.grid}>
            {byCategory.map(([category, amount]) => (
              <div className={styles.miniCard} key={category}>
                <span>{toTitle(category)}</span>
                <strong>{formatMoney(amount)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No breakdown yet" description="Reason totals appear after partner draw entries are saved." />
        )}
      </Card>

      <Card>
        <CardHeader title="Recent Money Taken" subtitle="Latest partner cash entries with site mapping where available." />
        {rows.length ? (
          <div className={styles.ledgerList}>
            {rows.slice(0, 8).map((row) => (
              <div className={styles.recoveryItem} key={row.id}>
                <div className={styles.itemTop}>
                  <div>
                    <h3>{row.partner_name}</h3>
                    <p>{row.date} | {toTitle(row.category)} | {sites.data?.find((site) => site.id === row.site_id)?.name || "Company"}</p>
                  </div>
                  <Badge tone="info">{formatMoney(row.amount)}</Badge>
                </div>
                {row.notes ? <p>{row.notes}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No recent entries" description="All partner money taken entries will appear here." />
        )}
      </Card>
    </section>
  );
}
