import { describe, expect, it } from "vitest";
import { consumptionSeries, type CategoryRow, type ExpenseRow } from "@/lib/calc";
import {
  detectAnomalies,
  detectDuplicateAnomalies,
  detectOdometerAnomalies,
  type AnomalyInputRow,
} from "@/lib/anomalies";

const FUEL: CategoryRow = {
  id: "cat-fuel",
  name: "Fuel",
  role: "fuel",
  unit: "l",
  sort_order: 0,
};
const CATEGORIES = [FUEL];

let seq = 0;
function fill(odometer_km: number, quantity: number, date: string): AnomalyInputRow {
  seq += 1;
  return {
    id: `e${String(seq).padStart(3, "0")}`,
    date,
    odometer_km,
    category_id: FUEL.id,
    role: "fuel",
    amount_minor: Math.round(quantity * 3800),
    quantity,
    full_tank: true,
    tags: [],
  };
}

/** Build a chain of full-tank fill-ups producing the given consumptions. */
function chain(consumptions: number[], stepKm = 600): AnomalyInputRow[] {
  const rows: AnomalyInputRow[] = [fill(100_000, 50, "2026-01-01")];
  let odo = 100_000;
  let day = 1;
  for (const c of consumptions) {
    odo += stepKm;
    day += 14;
    const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
    rows.push(fill(odo, (c / 100) * stepKm, date));
  }
  return rows;
}

function run(rows: AnomalyInputRow[]) {
  const series = consumptionSeries(rows as ExpenseRow[], CATEGORIES);
  return detectAnomalies(rows, series, CATEGORIES);
}

describe("consumption outliers", () => {
  it("flags the 4.2-vs-8.6 low outlier and blames a missing fill-up", () => {
    const rows = chain([8.6, 8.5, 8.8, 8.4, 4.2]);
    const flags = run(rows);
    const low = flags.filter((f) => f.kind === "consumption_low");
    expect(low).toHaveLength(1);
    expect(low[0].expense_id).toBe(rows[rows.length - 1].id);
    expect(low[0].message).toMatch(/missing/i);
    expect(low[0].severity).toBe("warning");
  });

  it("flags a high outlier and blames a low odometer or duplicate", () => {
    const rows = chain([8.6, 8.5, 8.8, 8.4, 24]);
    const flags = run(rows);
    const high = flags.filter((f) => f.kind === "consumption_high");
    expect(high).toHaveLength(1);
    expect(high[0].expense_id).toBe(rows[rows.length - 1].id);
    expect(high[0].message).toMatch(/odometer reading is too low|duplicate/i);
  });

  it("produces no flags for a clean dataset", () => {
    const rows = chain([8.5, 8.6, 8.4, 8.7, 8.3]);
    expect(run(rows)).toEqual([]);
  });

  it("catches an absolute-bounds violation even below the relative sample size", () => {
    const rows = chain([45]);
    const flags = run(rows);
    expect(flags).toHaveLength(1);
    expect(flags[0].kind).toBe("consumption_out_of_bounds");
    expect(flags[0].message).toMatch(/higher than any vehicle/i);
  });

  it("does not fire the relative rule below the minimum sample", () => {
    const rows = chain([8.5, 8.6, 4.5]);
    expect(run(rows).filter((f) => f.kind === "consumption_low")).toHaveLength(0);
  });

  it("hides flags on dismissed rows but keeps them with includeDismissed", () => {
    const rows = chain([8.6, 8.5, 8.8, 8.4, 4.2]);
    rows[rows.length - 1].anomaly_dismissed = true;
    const series = consumptionSeries(rows as ExpenseRow[], CATEGORIES);
    expect(detectAnomalies(rows, series, CATEGORIES)).toEqual([]);
    expect(
      detectAnomalies(rows, series, CATEGORIES, { includeDismissed: true }).length,
    ).toBe(1);
  });
});

describe("odometer vs date", () => {
  it("flags an odometer lower than an earlier-dated row", () => {
    const rows = [
      fill(100_000, 50, "2026-01-01"),
      fill(101_000, 50, "2026-02-01"),
      fill(90_000, 50, "2026-03-01"),
    ];
    const flags = detectOdometerAnomalies(rows);
    expect(flags).toHaveLength(1);
    expect(flags[0].expense_id).toBe(rows[2].id);
    expect(flags[0].kind).toBe("odometer_backwards");
    expect(flags[0].message).toMatch(/typo/i);
  });

  it("accepts a monotonic history", () => {
    const rows = [
      fill(100_000, 50, "2026-01-01"),
      fill(100_600, 50, "2026-01-15"),
      fill(101_200, 50, "2026-02-01"),
    ];
    expect(detectOdometerAnomalies(rows)).toEqual([]);
  });
});

describe("duplicates", () => {
  it("flags a second identical row on the same date", () => {
    const a = fill(100_000, 50, "2026-01-01");
    const b = { ...fill(100_000, 50, "2026-01-01"), amount_minor: a.amount_minor };
    const flags = detectDuplicateAnomalies([a, b]);
    expect(flags).toHaveLength(1);
    expect(flags[0].expense_id).toBe(b.id);
    expect(flags[0].severity).toBe("info");
  });

  it("does not flag different amounts on the same date", () => {
    const a = fill(100_000, 50, "2026-01-01");
    const b = { ...fill(100_400, 40, "2026-01-01") };
    expect(detectDuplicateAnomalies([a, b])).toEqual([]);
  });
});
