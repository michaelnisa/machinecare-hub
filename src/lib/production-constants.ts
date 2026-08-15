export const DOWNTIME_REASONS = [
  { code: "breakdown", label: "Breakdown / fault", category: "unplanned" },
  { code: "material_shortage", label: "Material shortage", category: "unplanned" },
  { code: "no_operator", label: "No operator available", category: "unplanned" },
  { code: "quality_hold", label: "Quality hold", category: "unplanned" },
  { code: "utility_failure", label: "Utility failure (power/water/air)", category: "unplanned" },
  { code: "other_unplanned", label: "Other unplanned", category: "unplanned" },
  { code: "changeover", label: "Changeover / setup", category: "planned" },
  { code: "planned_maintenance", label: "Planned maintenance", category: "planned" },
  { code: "break_shift_change", label: "Break / shift change", category: "planned" },
  { code: "cleaning_cip", label: "Cleaning / CIP", category: "planned" },
  { code: "other_planned", label: "Other planned", category: "planned" },
] as const;
export const REASON_MAP = new Map(DOWNTIME_REASONS.map((r) => [r.code, r]));

export const SCRAP_REASONS = [
  { code: "giveaway_overfill", label: "Giveaway / overfill" },
  { code: "underweight_reject", label: "Underweight / reject" },
  { code: "label_defect", label: "Label / print defect" },
  { code: "contamination", label: "Contamination" },
  { code: "changeover_waste", label: "Changeover waste" },
  { code: "damaged_packaging", label: "Damaged packaging" },
  { code: "other", label: "Other" },
] as const;
export const SCRAP_REASON_MAP = new Map(SCRAP_REASONS.map((r) => [r.code, r]));
