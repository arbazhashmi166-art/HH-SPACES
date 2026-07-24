import Link from "next/link";
import { ArrowRight, Calculator, FileText, Hammer, ReceiptText, WalletCards } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/app-icon";
import styles from "./BillingHubScreen.module.css";

type BillingAction = {
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: typeof ReceiptText;
};

const billActions: BillingAction[] = [
  {
    title: "Client Billing",
    body: "Record contract value, received payment, pending amount, mode and notes.",
    href: "/payments?add=1",
    cta: "Open Finance",
    icon: WalletCards
  },
  {
    title: "Supplier Bill Scan",
    body: "Capture or upload bill photos, verify OCR rows, then save materials or expenses.",
    href: "/bill-scanner",
    cta: "Scan Bill",
    icon: ReceiptText
  },
  {
    title: "Quotation Builder",
    body: "Calculate work rate, BOQ, GST, profit and customer quote from measurements.",
    href: "/rate-analyzer",
    cta: "Create Quote",
    icon: Calculator
  },
  {
    title: "Extra Work Billing",
    body: "Track approved variations and unbilled extra work before final settlement.",
    href: "/extra-works",
    cta: "Open Extra Work",
    icon: Hammer
  }
];

export function BillingHubScreen() {
  return (
    <section className={styles.stack}>
      <div className={styles.hero}>
        <span>Billing control</span>
        <strong>Bills & quotations</strong>
        <p>Client billing, supplier bill scanning, quotations, extra work and reports in one clean flow.</p>
      </div>

      <div className={styles.grid}>
        {billActions.map((action) => (
          <Link className={styles.actionCard} href={action.href} key={action.title}>
            <span className={styles.iconWrap} aria-hidden="true">
              <AppIcon icon={action.icon} />
            </span>
            <span>
              <strong>{action.title}</strong>
              <p>{action.body}</p>
            </span>
            <span className={styles.footer}>
              {action.cta}
              <AppIcon icon={ArrowRight} />
            </span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Billing Reports"
          subtitle="Export payment, material, expense, extra work and site summaries from Reports."
          action={
            <Link className={styles.footer} href="/reports">
              Reports <AppIcon icon={FileText} />
            </Link>
          }
        />
      </Card>
    </section>
  );
}
