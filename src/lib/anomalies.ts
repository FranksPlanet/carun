// Anomaly / outlier detection layer.
//
// This module is deliberately SEPARATE from src/lib/calc.ts: calc.ts stays a
// pure "what the numbers are" engine, and this file answers "which of those
// numbers look wrong, and why". It consumes calc.ts's existing output
// (consumptionSeries) plus the raw expense rows and returns flags only.
//
// Rules:
//  - never mutate, correct, drop or reorder any input
//  - never assume a locale, fuel type or vehicle type
//  - messages name the likely CAUSE and the check to make

import type { CategoryRow, ExpenseRow, FuelSeries } from "./calc";

export type AnomalyKind =
  | "consumption_low"
  | "consumption_high"
  | "consumption_out_of_bounds"
  | "odometer_backwards"
  | "duplicate";

export type AnomalySeverity = "warning" | "info";

export type AnomalyFlag = {
  expense_id: string;
  severity: AnomalySeverity;
  kind: AnomalyKind;
  message: string;
};

export type AnomalyInputRow = ExpenseRow & {
  anomaly_dismissed?: boolean | null;
};

// Deliberately wide bounds — we are catching the physically impossible, not
// the merely unusual. Values are "quantity per 100 km" in the category's unit.
// Units we don't recognise are simply not bounds-checked.
export const ABSOLUTE_BOUNDS: Record<string, { min: number; max: number }> = {
  l: { min: 2, max: 30 },
  litres: { min: 2, max: 30 },
  liters: { min: 2, max: 30 },
  gal: { min: 0.5, max: 8 },
  kwh: { min: 5, max: 60 },
  kg: { min: 1, max: 20 },
  m3: { min: 1, max: 25 },
};

// Minimum number of consumption points in a series before the relative
// (median/MAD) test is allowed to fire at all.
export const MIN_RELATIVE_SAMPLE = 4;

// Modified z-score cut-off (0.6745 * deviation / MAD). 3.5 is the standard
// Iglewicz–Hoaglin threshold; we use a slightly looser 4 so normal seasonal
// swings (winter/towing) don't nag.
export const MODIFIED_Z_THRESHOLD = 4;

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Median absolute deviation around the median.
export function mad(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

function fmtInt(n: number): string {
  const rounded = Math.round(n);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fmtQty(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function unitKey(unit: string): string {
  return unit.trim().toLowerCase();
}

function unitLabel(unit: string): string {
  return unit.trim();
}

/**
 * Rules 1–3: relative outliers (median + MAD, per fuel category) and absolute
 * plausibility bounds, with a direction-aware explanation of the likely cause.
 */
export function detectConsumptionAnomalies(
  series: FuelSeries[],
  expenses: AnomalyInputRow[],
): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];

  for (const s of series) {
    const values = s.points.map((p) => p.per_100km);
    const med = median(values);
    const dev = mad(values);
    const canRelative = values.length >= MIN_RELATIVE_SAMPLE && isFinite(dev) && dev > 0;
    const bounds = ABSOLUTE_BOUNDS[unitKey(s.unit)];
    const label = unitLabel(s.unit);

    for (const p of s.points) {
      const expense = expenses.find(
        (e) =>
          e.category_id === s.category_id &&
          e.odometer_km === p.odometer_km &&
          e.date === p.date,
      );
      if (!expense) continue;

      const startKm = p.odometer_km - p.distance_km;
      const spanText = `between ${fmtInt(startKm)} and ${fmtInt(p.odometer_km)} km`;
      const valueText = `${fmtQty(p.per_100km)} ${label}/100 km`;

      // Rule 2 — absolute bounds. Always active, works with a single point.
      if (bounds && (p.per_100km < bounds.min || p.per_100km > bounds.max)) {
        const low = p.per_100km < bounds.min;
        flags.push({
          expense_id: expense.id,
          severity: "warning",
          kind: "consumption_out_of_bounds",
          message: low
            ? `This fill-up works out at ${valueText}, which is below what any vehicle realistically uses. The usual cause is a missed fill-up ${spanText} — the distance is counted but the fuel for it isn't. An odometer reading that's too high does the same thing. Check whether a receipt is missing, or whether ${fmtInt(p.odometer_km)} km is right.`
            : `This fill-up works out at ${valueText}, which is higher than any vehicle realistically uses. The usual cause is an odometer reading that's too low, or the same fill-up entered twice. Check the ${fmtInt(p.odometer_km)} km reading and look for a duplicate entry.`,
        });
        continue;
      }

      // Rule 1 + 3 — relative outlier, direction implies cause.
      if (!canRelative) continue;
      const z = (0.6745 * (p.per_100km - med)) / dev;
      if (Math.abs(z) <= MODIFIED_Z_THRESHOLD) continue;

      const normText = `${fmtQty(med)} ${label}/100 km`;
      if (z < 0) {
        flags.push({
          expense_id: expense.id,
          severity: "warning",
          kind: "consumption_low",
          message: `${valueText} here, against a typical ${normText} for this vehicle. A figure this far below normal almost always means a fill-up is missing ${spanText} — the distance got counted but the fuel didn't — or that this odometer reading is too high. Check for a receipt you didn't log, then check the ${fmtInt(p.odometer_km)} km reading.`,
        });
      } else {
        flags.push({
          expense_id: expense.id,
          severity: "warning",
          kind: "consumption_high",
          message: `${valueText} here, against a typical ${normText} for this vehicle. A figure this far above normal usually means the odometer reading is too low, or this fill-up was entered twice. Check the ${fmtInt(p.odometer_km)} km reading and look for a duplicate.`,
        });
      }
    }
  }

  return flags;
}

/**
 * Rule 4 — odometer vs date disagreement. Sorted by date, an odometer that is
 * lower than one already seen is almost always a typo, and it silently
 * reorders the consumption history (which is ordered by odometer).
 */
export function detectOdometerAnomalies(expenses: AnomalyInputRow[]): AnomalyFlag[] {
  const sorted = [...expenses].sort((a, b) =>
    a.date === b.date ? a.odometer_km - b.odometer_km : a.date.localeCompare(b.date),
  );
  const flags: AnomalyFlag[] = [];
  let maxSoFar = -Infinity;
  let maxRow: AnomalyInputRow | null = null;
  for (const e of sorted) {
    if (maxRow && e.odometer_km < maxSoFar) {
      flags.push({
        expense_id: e.id,
        severity: "warning",
        kind: "odometer_backwards",
        message: `The odometer here (${fmtInt(e.odometer_km)} km) is lower than an earlier entry on ${maxRow.date} (${fmtInt(maxSoFar)} km). Odometers don't run backwards, so one of the two readings is almost certainly a typo. This also reorders your consumption history, so it's worth fixing.`,
      });
      continue;
    }
    maxSoFar = e.odometer_km;
    maxRow = e;
  }
  return flags;
}

/** Rule 5 — same date, same amount, same category, entered twice. */
export function detectDuplicateAnomalies(expenses: AnomalyInputRow[]): AnomalyFlag[] {
  const seen = new Map<string, AnomalyInputRow>();
  const flags: AnomalyFlag[] = [];
  const ordered = [...expenses].sort((a, b) => a.id.localeCompare(b.id));
  for (const e of ordered) {
    const key = `${e.date}|${e.amount_minor}|${e.category_id}`;
    const first = seen.get(key);
    if (first) {
      flags.push({
        expense_id: e.id,
        severity: "info",
        kind: "duplicate",
        message: `Another entry on ${e.date} has the same amount and the same category. That's usually the same receipt saved twice — worth checking before it doubles your totals.`,
      });
    } else {
      seen.set(key, e);
    }
  }
  return flags;
}

export type DetectOptions = {
  /** Include flags on rows the user has already dismissed. Default false. */
  includeDismissed?: boolean;
};

/** Full detection pass. Pure: reads inputs, returns flags, changes nothing. */
export function detectAnomalies(
  expenses: AnomalyInputRow[],
  series: FuelSeries[],
  _categories?: CategoryRow[],
  options: DetectOptions = {},
): AnomalyFlag[] {
  const all = [
    ...detectConsumptionAnomalies(series, expenses),
    ...detectOdometerAnomalies(expenses),
    ...detectDuplicateAnomalies(expenses),
  ];
  if (options.includeDismissed) return all;
  const dismissed = new Set(
    expenses.filter((e) => e.anomaly_dismissed).map((e) => e.id),
  );
  return all.filter((f) => !dismissed.has(f.expense_id));
}

/** Group flags by expense id for O(1) lookup while rendering a list. */
export function flagsByExpense(flags: AnomalyFlag[]): Map<string, AnomalyFlag[]> {
  const map = new Map<string, AnomalyFlag[]>();
  for (const f of flags) {
    const arr = map.get(f.expense_id);
    if (arr) arr.push(f);
    else map.set(f.expense_id, [f]);
  }
  return map;
}

/**
 * How many of the points behind a consumption average are flagged — used to
 * annotate headline averages ("includes 1 flagged entry") without dropping
 * anything from the maths.
 */
export function flaggedPointCount(
  series: FuelSeries,
  expenses: AnomalyInputRow[],
  flags: AnomalyFlag[],
): number {
  const flagged = new Set(
    flags
      .filter(
        (f) =>
          f.kind === "consumption_low" ||
          f.kind === "consumption_high" ||
          f.kind === "consumption_out_of_bounds",
      )
      .map((f) => f.expense_id),
  );
  let n = 0;
  for (const p of series.points) {
    const e = expenses.find(
      (x) =>
        x.category_id === series.category_id &&
        x.odometer_km === p.odometer_km &&
        x.date === p.date,
    );
    if (e && flagged.has(e.id)) n++;
  }
  return n;
}
