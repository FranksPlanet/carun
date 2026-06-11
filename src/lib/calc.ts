// Pure calculation engine. Inputs are canonical: amounts in minor currency
// units, distances in km, volumes in liters.

export type ExpenseRow = {
  id: string;
  date: string;
  odometer_km: number;
  category: "fuel" | "service" | "admin" | "other";
  amount_minor: number;
  liters: number | null;
  full_tank: boolean | null;
  tags: string[];
};

export type RecurringRow = {
  amount_minor_per_year: number;
};

export type PastRepairRow = {
  amount_minor: number;
};

export type VehicleRow = {
  purchase_date: string;
  purchase_odometer_km: number;
  purchase_price_minor: number;
};

const LOADED_TAGS = new Set(["Towing", "Fully loaded", "Roof box"]);
export const CONTEXT_TAGS = [
  "Towing",
  "Fully loaded",
  "City",
  "Highway",
  "Winter",
  "AC heavy",
  "Roof box",
] as const;

export function trackedKm(expenses: ExpenseRow[]): number {
  if (expenses.length === 0) return 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const e of expenses) {
    if (e.odometer_km < lo) lo = e.odometer_km;
    if (e.odometer_km > hi) hi = e.odometer_km;
  }
  return Math.max(0, hi - lo);
}

export function totalsByCategory(expenses: ExpenseRow[]): Record<string, number> {
  const out: Record<string, number> = { fuel: 0, service: 0, admin: 0, other: 0 };
  for (const e of expenses) out[e.category] = (out[e.category] ?? 0) + e.amount_minor;
  return out;
}

export function totalLogged(expenses: ExpenseRow[]): number {
  return expenses.reduce((s, e) => s + e.amount_minor, 0);
}

export function costPerKm(expenses: ExpenseRow[]): number {
  const km = trackedKm(expenses);
  if (km <= 0) return 0;
  return totalLogged(expenses) / km;
}

export function categoryCostPerKm(expenses: ExpenseRow[]): Record<string, number> {
  const km = trackedKm(expenses);
  const by = totalsByCategory(expenses);
  const out: Record<string, number> = {};
  for (const k of Object.keys(by)) out[k] = km > 0 ? by[k] / km : 0;
  return out;
}

export type ConsumptionPoint = {
  date: string;
  odometer_km: number;
  liters: number;
  distance_km: number;
  l_per_100km: number;
  price_per_liter: number;
  tags: string[];
  is_loaded: boolean;
  is_spike: boolean;
  baseline: number | null;
};

export function consumptionPoints(expenses: ExpenseRow[]): ConsumptionPoint[] {
  const fuels = expenses
    .filter((e) => e.category === "fuel" && e.liters && e.liters > 0)
    .sort((a, b) => a.odometer_km - b.odometer_km);
  const points: ConsumptionPoint[] = [];
  let lastFullIdx = -1;
  for (let i = 0; i < fuels.length; i++) {
    if (!fuels[i].full_tank) continue;
    if (lastFullIdx >= 0) {
      // sum liters from (lastFullIdx, i] excluding the lastFullIdx fillup itself
      let liters = 0;
      for (let k = lastFullIdx + 1; k <= i; k++) liters += fuels[k].liters ?? 0;
      const dist = fuels[i].odometer_km - fuels[lastFullIdx].odometer_km;
      const lp = fuels[i].liters ?? 0;
      const amt = fuels[i].amount_minor;
      if (dist > 0 && liters > 0) {
        const consumption = (liters / dist) * 100;
        points.push({
          date: fuels[i].date,
          odometer_km: fuels[i].odometer_km,
          liters,
          distance_km: dist,
          l_per_100km: consumption,
          price_per_liter: lp > 0 ? amt / lp : 0,
          tags: fuels[i].tags,
          is_loaded: fuels[i].tags.some((t) => LOADED_TAGS.has(t)),
          is_spike: false,
          baseline: null,
        });
      }
    }
    lastFullIdx = i;
  }
  // spike detection: baseline = avg of up to prior 5
  for (let i = 0; i < points.length; i++) {
    const prior = points.slice(Math.max(0, i - 5), i);
    if (prior.length === 0) continue;
    const baseline = prior.reduce((s, p) => s + p.l_per_100km, 0) / prior.length;
    points[i].baseline = baseline;
    if (points[i].l_per_100km > baseline * 1.15) points[i].is_spike = true;
  }
  return points;
}

export function segmentedAverages(points: ConsumptionPoint[]): { clean: number | null; loaded: number | null } {
  const clean = points.filter((p) => !p.is_loaded);
  const loaded = points.filter((p) => p.is_loaded);
  const avg = (xs: ConsumptionPoint[]) =>
    xs.length === 0 ? null : xs.reduce((s, p) => s + p.l_per_100km, 0) / xs.length;
  return { clean: avg(clean), loaded: avg(loaded) };
}

export function averageConsumption(points: ConsumptionPoint[]): number | null {
  if (points.length === 0) return null;
  return points.reduce((s, p) => s + p.l_per_100km, 0) / points.length;
}

export function pricePerLiterSeries(expenses: ExpenseRow[]): { date: string; price: number }[] {
  return expenses
    .filter((e) => e.category === "fuel" && e.liters && e.liters > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, price: e.amount_minor / (e.liters as number) }));
}

export function cumulativeSpend(expenses: ExpenseRow[]): { date: string; total: number }[] {
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  return sorted.map((e) => {
    running += e.amount_minor;
    return { date: e.date, total: running };
  });
}

export type Backfill = {
  km_variable_minor: number;
  recurring_minor: number;
  past_repairs_minor: number;
  total_minor: number;
  gap_km: number;
  gap_years: number;
};

export function computeBackfill(
  vehicle: VehicleRow,
  expenses: ExpenseRow[],
  recurring: RecurringRow[],
  repairs: PastRepairRow[],
): Backfill {
  if (expenses.length === 0) {
    return { km_variable_minor: 0, recurring_minor: 0, past_repairs_minor: 0, total_minor: 0, gap_km: 0, gap_years: 0 };
  }
  const sorted = [...expenses].sort((a, b) => a.odometer_km - b.odometer_km);
  const lowestLoggedOdo = sorted[0].odometer_km;
  const firstLoggedDate = [...expenses].sort((a, b) => a.date.localeCompare(b.date))[0].date;
  const gap_km = Math.max(0, lowestLoggedOdo - vehicle.purchase_odometer_km);
  const purchase = new Date(vehicle.purchase_date).getTime();
  const first = new Date(firstLoggedDate).getTime();
  const gap_years = Math.max(0, (first - purchase) / (1000 * 60 * 60 * 24 * 365.25));

  // fuel-only per-km rate for backfill (service/other are time-based or one-off)
  const km = trackedKm(expenses);
  const by = totalsByCategory(expenses);
  const fuelRatePerKm = km > 0 ? by.fuel / km : 0;
  const km_variable_minor = Math.round(fuelRatePerKm * gap_km);

  const yearlyRecurring = recurring.reduce((s, r) => s + r.amount_minor_per_year, 0);
  const recurring_minor = Math.round(yearlyRecurring * gap_years);
  const past_repairs_minor = repairs.reduce((s, r) => s + r.amount_minor, 0);
  return {
    km_variable_minor,
    recurring_minor,
    past_repairs_minor,
    total_minor: km_variable_minor + recurring_minor + past_repairs_minor,
    gap_km,
    gap_years,
  };
}

export function lifetimeCostSoFar(
  vehicle: VehicleRow,
  expenses: ExpenseRow[],
  recurring: RecurringRow[],
  repairs: PastRepairRow[],
): { actual_minor: number; estimated_minor: number; total_minor: number } {
  const backfill = computeBackfill(vehicle, expenses, recurring, repairs);
  // tracked years (from first logged to today)
  const firstLogged = expenses.length
    ? [...expenses].sort((a, b) => a.date.localeCompare(b.date))[0].date
    : null;
  let trackedYears = 0;
  if (firstLogged) {
    trackedYears = Math.max(
      0,
      (Date.now() - new Date(firstLogged).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    );
  }
  const yearlyRecurring = recurring.reduce((s, r) => s + r.amount_minor_per_year, 0);
  const recurringTracked = Math.round(yearlyRecurring * trackedYears);

  const actual = vehicle.purchase_price_minor + totalLogged(expenses);
  const estimated = backfill.total_minor + recurringTracked;
  return { actual_minor: actual, estimated_minor: estimated, total_minor: actual + estimated };
}

export type LifetimeBreakdown = {
  // Actual (known) figures
  purchase_price_minor: number;
  logged_total_minor: number;
  recurring_tracked_minor: number;
  tracked_years: number;
  // Estimated figures (pre-tracking)
  gap_km: number;
  gap_years: number;
  per_km_variable_minor: number;
  backfilled_running_minor: number;
  backfilled_yearly_minor: number;
  remembered_repairs_minor: number;
  // Totals
  actual_minor: number;
  estimated_minor: number;
  total_minor: number;
};

export function lifetimeBreakdown(
  vehicle: VehicleRow,
  expenses: ExpenseRow[],
  recurring: RecurringRow[],
  repairs: PastRepairRow[],
): LifetimeBreakdown {
  const logged_total_minor = totalLogged(expenses);
  const yearlyRecurring = recurring.reduce((s, r) => s + r.amount_minor_per_year, 0);

  // Tracked window
  const sortedByDate = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  const firstLoggedDate = sortedByDate.length ? sortedByDate[0].date : null;
  let tracked_years = 0;
  if (firstLoggedDate) {
    tracked_years = Math.max(
      0,
      (Date.now() - new Date(firstLoggedDate).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25),
    );
  }
  const recurring_tracked_minor = Math.round(yearlyRecurring * tracked_years);

  // Pre-tracking gap
  let gap_km = 0;
  let gap_years = 0;
  if (expenses.length > 0) {
    const sortedByOdo = [...expenses].sort((a, b) => a.odometer_km - b.odometer_km);
    gap_km = Math.max(0, sortedByOdo[0].odometer_km - vehicle.purchase_odometer_km);
    const purchase = new Date(vehicle.purchase_date).getTime();
    const first = new Date(firstLoggedDate!).getTime();
    gap_years = Math.max(0, (first - purchase) / (1000 * 60 * 60 * 24 * 365.25));
  }

  // Fuel-only per-km rate for backfill (service/other are time-based or one-off)
  const km = trackedKm(expenses);
  const by = totalsByCategory(expenses);
  const per_km_variable_minor = km > 0 ? (by.fuel ?? 0) / km : 0;

  const backfilled_running_minor = Math.round(per_km_variable_minor * gap_km);
  const backfilled_yearly_minor = Math.round(yearlyRecurring * gap_years);
  const remembered_repairs_minor = repairs.reduce((s, r) => s + r.amount_minor, 0);

  const actual_minor =
    vehicle.purchase_price_minor + logged_total_minor + recurring_tracked_minor;
  const estimated_minor =
    backfilled_running_minor + backfilled_yearly_minor + remembered_repairs_minor;

  return {
    purchase_price_minor: vehicle.purchase_price_minor,
    logged_total_minor,
    recurring_tracked_minor,
    tracked_years,
    gap_km,
    gap_years,
    per_km_variable_minor,
    backfilled_running_minor,
    backfilled_yearly_minor,
    remembered_repairs_minor,
    actual_minor,
    estimated_minor,
    total_minor: actual_minor + estimated_minor,
  };
}

export type ProjectionInput = {
  annual_km: number;
  fuel_price_per_liter_minor: number; // price in currency minor units per liter
  horizon_years: number;
};

export type ProjectionPoint = {
  year: number;
  cumulative_minor: number;
  fuel_cumulative_minor: number;
};

export type ProjectionResult = {
  points: ProjectionPoint[];
  fuel_minor_per_km: number;
  nonfuel_minor_per_km: number;
  yearly_running_minor: number;
  total_horizon_minor: number;
  crossover_year: number | null;
  using_measured_consumption: boolean;
  avg_consumption_l_per_100km: number;
};

export function projection(
  vehicle: VehicleRow,
  expenses: ExpenseRow[],
  recurring: RecurringRow[],
  input: ProjectionInput,
): ProjectionResult {
  const points = consumptionPoints(expenses);
  const measured = averageConsumption(points);
  const consumption = measured ?? 7.5;
  const fuelPerKm = (consumption / 100) * input.fuel_price_per_liter_minor;

  // Non-fuel per km from tracked data (service + admin + other).
  const km = trackedKm(expenses);
  const by = totalsByCategory(expenses);
  const nonFuel = by.service + by.admin + by.other;
  const nonFuelPerKm = km > 0 ? nonFuel / km : 0;

  const yearlyRecurring = recurring.reduce((s, r) => s + r.amount_minor_per_year, 0);
  const yearlyRunning = Math.round(
    (fuelPerKm + nonFuelPerKm) * input.annual_km + yearlyRecurring,
  );

  const pts: ProjectionPoint[] = [];
  let cum = vehicle.purchase_price_minor;
  let fuelCum = 0;
  let crossover: number | null = null;
  for (let y = 1; y <= input.horizon_years; y++) {
    cum += yearlyRunning;
    fuelCum += Math.round(fuelPerKm * input.annual_km);
    pts.push({ year: y, cumulative_minor: cum, fuel_cumulative_minor: fuelCum });
    if (crossover == null && fuelCum >= vehicle.purchase_price_minor) crossover = y;
  }
  return {
    points: pts,
    fuel_minor_per_km: fuelPerKm,
    nonfuel_minor_per_km: nonFuelPerKm,
    yearly_running_minor: yearlyRunning,
    total_horizon_minor: cum,
    crossover_year: crossover,
    using_measured_consumption: measured != null,
    avg_consumption_l_per_100km: consumption,
  };
}

// Fuzzy date helpers
export function representativeDateFromPrecision(
  precision: "exact" | "month" | "season" | "year",
  year: number,
  month?: number | null,
  season?: "spring" | "summer" | "autumn" | "winter" | null,
  exact_date?: string | null,
): string {
  if (precision === "exact" && exact_date) return exact_date;
  if (precision === "month" && month) {
    return new Date(Date.UTC(year, month - 1, 15)).toISOString().slice(0, 10);
  }
  if (precision === "season" && season) {
    const m = { spring: 3, summer: 6, autumn: 9, winter: 12 }[season];
    return new Date(Date.UTC(year, m - 1, 15)).toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(year, 5, 30)).toISOString().slice(0, 10);
}

export function formatFuzzyDate(
  precision: "exact" | "month" | "season" | "year",
  year: number,
  month?: number | null,
  season?: "spring" | "summer" | "autumn" | "winter" | null,
  exact_date?: string | null,
): string {
  if (precision === "exact" && exact_date) {
    return new Date(exact_date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  if (precision === "month" && month) {
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  }
  if (precision === "season" && season) {
    const cap = season[0].toUpperCase() + season.slice(1);
    return `${cap} ${year}`;
  }
  return String(year);
}
