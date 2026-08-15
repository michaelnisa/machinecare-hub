export const STATUS_FLOW = [
  "received", "diagnosing", "estimate", "awaiting_approval", "approved",
  "in_progress", "quality_check", "ready", "delivered", "closed",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  received: "Received", diagnosing: "Diagnosing", estimate: "Estimate", awaiting_approval: "Awaiting approval",
  approved: "Approved", in_progress: "In progress", quality_check: "Quality check", ready: "Ready",
  delivered: "Delivered", closed: "Closed", cancelled: "Cancelled",
};

export const STATUS_BADGE: Record<string, string> = {
  received: "bg-blue-100 text-blue-700", diagnosing: "bg-indigo-100 text-indigo-700", estimate: "bg-purple-100 text-purple-700",
  awaiting_approval: "bg-amber-100 text-amber-700", approved: "bg-teal-100 text-teal-700", in_progress: "bg-orange-100 text-orange-700",
  quality_check: "bg-violet-100 text-violet-700", ready: "bg-emerald-100 text-emerald-700", delivered: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-600", cancelled: "bg-red-100 text-red-700",
};

export const PRIORITY_BORDER: Record<string, string> = {
  low: "border-l-slate-400", normal: "border-l-blue-500", high: "border-l-amber-500", urgent: "border-l-red-500",
};

export function formatJobNumber(j: { job_year: number; job_number: number }) {
  return `JOB-${j.job_year}-${String(j.job_number).padStart(4, "0")}`;
}
