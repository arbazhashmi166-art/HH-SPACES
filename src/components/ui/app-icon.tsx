import type { LucideIcon } from "lucide-react";

type AppIconProps = {
  icon: LucideIcon;
  className?: string;
};

export function AppIcon({ icon: Icon, className }: AppIconProps) {
  return <Icon aria-hidden="true" className={["appIcon", className].filter(Boolean).join(" ")} strokeWidth={2.35} />;
}
