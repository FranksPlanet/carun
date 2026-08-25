// Effective current odometer.
//
// `vehicles.current_odometer_km` is only ever written once, by the onboarding
// wizard, so it freezes at the reading the car had on the day the user signed
// up. Every expense, however, carries its own odometer reading, so the true
// current odometer is already knowable from data we hold.
//
// Taking the MAXIMUM of the stored value and the highest logged reading means
// the figure can only move forward: a user who drives without logging keeps
// their manually-set number, and a user who logs regularly gets one that
// self-corrects. Pure, read-only — no data is written anywhere.

export type OdometerVehicle = { current_odometer_km?: number | null } | null | undefined;
export type OdometerExpense = { odometer_km?: number | null };

/** Highest odometer reading across a set of expenses (0 when there are none). */
export function maxExpenseOdometer(expenses: readonly OdometerExpense[] | null | undefined): number {
  let max = 0;
  for (const e of expenses ?? []) {
    const km = e?.odometer_km;
    if (typeof km === "number" && isFinite(km) && km > max) max = km;
  }
  return max;
}

/**
 * The greater of the vehicle's stored current odometer and the highest
 * odometer reading logged against it. Falls back to the stored value (or 0)
 * when there are no expenses.
 */
export function effectiveCurrentOdometerKm(
  vehicle: OdometerVehicle,
  expenses: readonly OdometerExpense[] | null | undefined,
): number {
  const stored = vehicle?.current_odometer_km;
  const base = typeof stored === "number" && isFinite(stored) ? stored : 0;
  return Math.max(base, maxExpenseOdometer(expenses));
}
