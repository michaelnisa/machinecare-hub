// Predicts when a PM schedule is actually due by blending the calendar
// interval with a usage rate derived from meter-reading history — because
// without live telemetry, a pure hours interval is only as good as how
// often someone manually logs a reading, and a pure date interval ignores
// how hard the machine is actually being run.

export type Confidence = "none" | "low" | "medium" | "high";

export interface UsageEstimate {
  ratePerDay: number | null; // hours or km per day, whichever unit the machine uses
  confidence: Confidence;
  sampleSize: number;
}

export function estimateUsageRate(
  readings: { reading: number; reading_date: string }[],
): UsageEstimate {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime(),
  );
  if (sorted.length < 2) {
    return { ratePerDay: null, confidence: "none", sampleSize: sorted.length };
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = (new Date(last.reading_date).getTime() - new Date(first.reading_date).getTime()) / 86400000;
  if (days <= 0) return { ratePerDay: null, confidence: "none", sampleSize: sorted.length };

  const rate = (last.reading - first.reading) / days;
  if (rate <= 0) return { ratePerDay: null, confidence: "low", sampleSize: sorted.length };

  const confidence: Confidence =
    sorted.length >= 5 && days >= 14 ? "high" : sorted.length >= 3 && days >= 7 ? "medium" : "low";

  return { ratePerDay: rate, confidence, sampleSize: sorted.length };
}

export type DrivenBy = "usage" | "calendar" | "both" | "none";

export interface SchedulePrediction {
  daysRemaining: number | null; // negative = overdue
  status: "ok" | "due_soon" | "overdue";
  drivenBy: DrivenBy;
  estimatedDueDate: Date | null;
  usageConfidence: Confidence;
}

export function predictScheduleDue(params: {
  nextDueDate?: string | null;
  nextDueHours?: number | null;
  currentHours?: number | null;
  usage: UsageEstimate;
}): SchedulePrediction {
  const { nextDueDate, nextDueHours, currentHours, usage } = params;
  const now = new Date();

  const calendarDays =
    nextDueDate != null ? (new Date(nextDueDate).getTime() - now.getTime()) / 86400000 : null;

  const usageDays =
    nextDueHours != null && currentHours != null && usage.ratePerDay
      ? (nextDueHours - currentHours) / usage.ratePerDay
      : null;

  let daysRemaining: number | null = null;
  let drivenBy: DrivenBy = "none";
  if (calendarDays != null && usageDays != null) {
    daysRemaining = Math.min(calendarDays, usageDays);
    drivenBy = "both";
  } else if (calendarDays != null) {
    daysRemaining = calendarDays;
    drivenBy = "calendar";
  } else if (usageDays != null) {
    daysRemaining = usageDays;
    drivenBy = "usage";
  }

  const status: SchedulePrediction["status"] =
    daysRemaining == null ? "ok" : daysRemaining < 0 ? "overdue" : daysRemaining <= 14 ? "due_soon" : "ok";

  const estimatedDueDate =
    daysRemaining != null ? new Date(now.getTime() + daysRemaining * 86400000) : null;

  return { daysRemaining, status, drivenBy, estimatedDueDate, usageConfidence: usage.confidence };
}

export function formatDaysRemaining(days: number | null): string {
  if (days == null) return "—";
  const rounded = Math.round(Math.abs(days));
  if (days < 0) return `Overdue by ${rounded} ${rounded === 1 ? "day" : "days"}`;
  if (rounded === 0) return "Due today";
  return `${rounded} ${rounded === 1 ? "day" : "days"} remaining`;
}
