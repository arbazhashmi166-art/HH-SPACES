import { FileSearch } from "lucide-react";
import { Card } from "./card";
import styles from "./empty-state.module.css";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className={styles.empty}>
      <FileSearch size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </Card>
  );
}
