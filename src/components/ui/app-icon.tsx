import type { CSSProperties } from "react";

type AppIconProps = {
  icon: string;
  className?: string;
};

export function AppIcon({ icon, className }: AppIconProps) {
  return (
    <span
      aria-hidden="true"
      className={["appIcon", className].filter(Boolean).join(" ")}
      style={{ "--app-icon-url": `url("${icon}")` } as CSSProperties}
    />
  );
}
