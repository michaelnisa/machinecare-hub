export const TYRE_DUE_SOON_KM = 1000;

// Older tyre records may still use the pre-axle naming (FL/RR2/etc.) — map them
// onto the axle-based codes (A1L, B2R, ...) so every view stays consistent
// without needing to rewrite existing rows.
const LEGACY_TYRE_POSITION_MAP: Record<string, string> = {
  FL: "A1L", FR: "A1R",
  RL: "B1L", RR: "B1R",
  RL2: "B2L", RR2: "B2R",
  RL3: "B3L", RR3: "B3R",
};
export const normalizeTyrePosition = (raw: string) => LEGACY_TYRE_POSITION_MAP[raw] ?? raw;

export function tyreStatus(
  tyre: { target_replace_km: number | null; fitted_odo: number | null },
  currentOdo: number | null,
): "ok" | "due_soon" | "overdue" {
  if (!tyre.target_replace_km || tyre.fitted_odo == null || currentOdo == null) return "ok";
  const kmSinceFit = currentOdo - tyre.fitted_odo;
  const remaining = tyre.target_replace_km - kmSinceFit;
  if (remaining <= 0) return "overdue";
  if (remaining <= TYRE_DUE_SOON_KM) return "due_soon";
  return "ok";
}
