import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./badge.module.css";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn(styles.badge, styles[tone], className)} {...props} />;
}
