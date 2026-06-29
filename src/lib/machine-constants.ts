import { Car, Construction, Zap, Droplet, Package, type LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Vehicle: Car,
  "Heavy Equipment": Construction,
  Generator: Zap,
  Pump: Droplet,
  Other: Package,
};

export const CATEGORIES = ["Vehicle", "Heavy Equipment", "Generator", "Pump", "Other"];

export const SERVICE_TYPES = [
  { value: "small_service", label: "Small service" },
  { value: "major_service", label: "Major service" },
  { value: "repair", label: "Repair" },
  { value: "inspection", label: "Inspection" },
  { value: "modification", label: "Modification" },
];

export const SCHEDULE_TYPES = [
  { value: "small", label: "Small" },
  { value: "major", label: "Major" },
  { value: "inspection", label: "Inspection" },
];

export const KNOWLEDGE_CATEGORIES = ["procedure", "safety", "troubleshooting", "specification"];

export const STATUS_LABELS: Record<string, string> = {
  ok: "OK",
  due_soon: "Due soon",
  overdue: "Overdue",
  active: "Active",
  under_maintenance: "Under maintenance",
  retired: "Retired",
  completed: "Completed",
  in_progress: "In progress",
};

export function scheduleStatus(nextDueDate?: string | null): "ok" | "due_soon" | "overdue" {
  if (!nextDueDate) return "ok";
  const now = new Date();
  const due = new Date(nextDueDate);
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 14) return "due_soon";
  return "ok";
}
