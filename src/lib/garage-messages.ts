import { formatMoney, formatNumber } from "@/lib/format";

export const TRIGGER_EVENTS = [
  "job_received", "estimate_ready", "approval_request", "repair_update",
  "vehicle_ready", "invoice", "payment_confirmation", "service_reminder", "custom",
] as const;

export const TRIGGER_EVENT_LABEL: Record<string, string> = {
  job_received: "Job received", estimate_ready: "Estimate ready", approval_request: "Approval request",
  repair_update: "Repair update", vehicle_ready: "Vehicle ready", invoice: "Invoice",
  payment_confirmation: "Payment confirmation", service_reminder: "Service reminder", custom: "Custom",
};

type TemplateCtx = {
  customerName?: string;
  vehicleLabel?: string;
  problem?: string;
  total?: number;
  amount?: number;
  mileage?: number;
  nextServiceMileage?: number;
};

export function buildMessage(event: string, ctx: TemplateCtx): string {
  const name = ctx.customerName || "there";
  const vehicle = ctx.vehicleLabel || "your vehicle";
  switch (event) {
    case "job_received":
      return `Hello ${name} 👋\n\nWe've received ${vehicle}${ctx.problem ? ` for: ${ctx.problem}` : ""}.\n\nWe'll update you once diagnosis is complete.`;
    case "estimate_ready":
      return `Hello ${name} 👋\n\nThe estimate for ${vehicle} is ready: ${ctx.total != null ? formatMoney(ctx.total) : "—"}.\n\nPlease let us know if you'd like to approve it.`;
    case "approval_request":
      return `Hello ${name} 👋\n\nWe need your approval to proceed on ${vehicle}.\n\nEstimate total: ${ctx.total != null ? formatMoney(ctx.total) : "—"}.`;
    case "repair_update":
      return `Hello ${name} 👋\n\nJust an update — work on ${vehicle} is in progress.`;
    case "vehicle_ready":
      return `Hello ${name} 👋\n\n${vehicle} is ready for pickup.\n\nTotal: ${ctx.total != null ? formatMoney(ctx.total) : "—"}\nStatus: READY\n\nThank you for choosing our workshop.`;
    case "invoice":
      return `Hello ${name} 👋\n\nYour invoice for ${vehicle} is ready: ${ctx.total != null ? formatMoney(ctx.total) : "—"}.`;
    case "payment_confirmation":
      return `Hello ${name} 👋\n\nWe've received your payment of ${ctx.amount != null ? formatMoney(ctx.amount) : "—"}. Thank you!`;
    case "service_reminder":
      return `Hello ${name} 👋\n\n${vehicle} is due for its next service soon.\n\nCurrent mileage: ${ctx.mileage != null ? formatNumber(ctx.mileage) : "—"} km\nRecommended service: ${ctx.nextServiceMileage != null ? formatNumber(ctx.nextServiceMileage) : "—"} km\n\nBook a service whenever it's convenient.`;
    default:
      return "";
  }
}
