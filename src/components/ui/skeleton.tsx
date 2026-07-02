import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./skeleton.module.css";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.skeleton, className)} {...props} />;
}
