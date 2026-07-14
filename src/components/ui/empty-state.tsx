import { FileSearch } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";
import styles from "./empty-state.module.css";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className={styles.empty}>
      <FileSearch size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </Card>
  );
}
