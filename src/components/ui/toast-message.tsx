"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import styles from "./toast-message.module.css";

export function ToastMessage({
  message,
  duration = 2400,
  onDismiss,
  tone = "default"
}: {
  message: string | null;
  duration?: number;
  onDismiss: () => void;
  tone?: "default" | "success";
}) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, onDismiss]);

  if (!message) return null;

  return (
    <div className={cn(styles.toast, tone === "success" && styles.success)} role="status" aria-live="polite">
      {message}
    </div>
  );
}
