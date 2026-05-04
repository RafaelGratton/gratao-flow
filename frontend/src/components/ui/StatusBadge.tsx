import { Badge } from "@/components/ui/Badge";

type StatusBadgeProps = {
  label: string;
  status?: "idle" | "active" | "done" | "warning" | "danger";
};

const toneByStatus = {
  idle: "neutral",
  active: "accent",
  done: "success",
  warning: "warning",
  danger: "danger"
} as const;

export function StatusBadge({ label, status = "idle" }: StatusBadgeProps) {
  return <Badge tone={toneByStatus[status]}>{label}</Badge>;
}
