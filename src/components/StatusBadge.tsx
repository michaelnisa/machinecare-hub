import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/machine-constants";

interface Props {
  status: string;
  className?: string;
}

const MAP: Record<string, string> = {
  ok: "status-ok",
  active: "status-ok",
  completed: "status-ok",
  due_soon: "status-due",
  overdue: "status-overdue",
  under_maintenance: "status-maintenance",
  in_progress: "status-maintenance",
  retired: "status-inactive",
};

export function StatusBadge({ status, className }: Props) {
  const safeStatus = typeof status === "string" ? status : "";
  const cls = MAP[safeStatus] ?? "status-inactive";
  const label = STATUS_LABELS[safeStatus] ?? (safeStatus ? safeStatus.replace(/_/g, " ") : "—");
  return <span className={cn("status-pill", cls, className)}>{label}</span>;
}
