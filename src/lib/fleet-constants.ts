export const TYRE_DUE_SOON_KM = 1000;

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
