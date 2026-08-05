import { describe, expect, it } from "vitest";
import { consumptionSeries, type CategoryRow, type ExpenseRow } from "@/lib/calc";
import {
  detectAnomalies,
  detectBeforePurchaseAnomalies,
  detectPriceMagnitudeAnomalies,
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
    expect(flags[0].message).toMatch(/higher than any car/i);
  });

  it("catches a small-sample low outlier via leave-one-out (3 points)", () => {
    const rows = chain([8.5, 8.6, 4.5]);
    const low = run(rows).filter((f) => f.kind === "consumption_low");
    expect(low).toHaveLength(1);
    expect(low[0].expense_id).toBe(rows[rows.length - 1].id);
  });

  it("catches the two-point real-world case [8.6, 4.2]", () => {
    const rows = chain([8.6, 4.2]);
    const low = run(rows).filter((f) => f.kind === "consumption_low");
    expect(low).toHaveLength(1);
    expect(low[0].expense_id).toBe(rows[rows.length - 1].id);
    expect(low[0].message).toMatch(/missing/i);
  });

  it("stays silent on the corrected real data [8.6, 8.22, 8.22]", () => {
    expect(run(chain([8.6, 8.22, 8.22]))).toEqual([]);
  });

  it("catches a small-sample high outlier", () => {
    const rows = chain([8.5, 18]);
    const high = run(rows).filter((f) => f.kind === "consumption_high");
    expect(high).toHaveLength(1);
  });

  it("does not compare a single-point series against anything", () => {
    expect(run(chain([8.6]))).toEqual([]);
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

describe("expense before purchase date", () => {
  it("flags an expense dated before the car was bought", () => {
    const rows = [fill(100_000, 50, "2024-07-01"), fill(100_600, 50, "2026-07-05")];
    const flags = detectBeforePurchaseAnomalies(rows, { purchase_date: "2026-06-26" });
    expect(flags).toHaveLength(1);
    expect(flags[0].expense_id).toBe(rows[0].id);
    expect(flags[0].kind).toBe("before_purchase");
    expect(flags[0].message).toMatch(/year/i);
  });

  it("accepts entries on or after the purchase date", () => {
    const rows = [fill(100_000, 50, "2026-06-26"), fill(100_600, 50, "2026-07-05")];
    expect(detectBeforePurchaseAnomalies(rows, { purchase_date: "2026-06-26" })).toEqual([]);
  });
});

describe("order-of-magnitude price", () => {
  /** Build a fuel row at an exact price per litre. */
  function atPrice(pricePerL: number, odo: number, date: string): AnomalyInputRow {
    const qty = 50;
    const row = fill(odo, qty, date);
    row.amount_minor = Math.round(pricePerL * 100 * qty);
    return row;
  }

  it("stays silent across a genuine 33.50-51.33 Kc/l spread", () => {
    const rows = [
      atPrice(33.5, 100_000, "2026-01-01"),
      atPrice(38.9, 100_600, "2026-01-15"),
      atPrice(44.2, 101_200, "2026-02-01"),
      atPrice(51.33, 101_800, "2026-02-15"),
    ];
    expect(detectPriceMagnitudeAnomalies(rows)).toEqual([]);
  });

  it("flags a currency mix-up (137 EUR typed as 137 CZK)", () => {
    const rows = [
      atPrice(33.5, 100_000, "2026-01-01"),
      atPrice(38.9, 100_600, "2026-01-15"),
      atPrice(44.2, 101_200, "2026-02-01"),
      atPrice(51.33, 101_800, "2026-02-15"),
      atPrice(1.5, 102_400, "2026-03-01"),
    ];
    const flags = detectPriceMagnitudeAnomalies(rows);
    expect(flags).toHaveLength(1);
    expect(flags[0].expense_id).toBe(rows[4].id);
    expect(flags[0].severity).toBe("info");
    expect(flags[0].message).toMatch(/currency/i);
  });

  it("skips the price rule without enough baseline points", () => {
    const rows = [
      atPrice(40, 100_000, "2026-01-01"),
      atPrice(40, 100_600, "2026-01-15"),
      atPrice(1.5, 101_200, "2026-02-01"),
    ];
    expect(detectPriceMagnitudeAnomalies(rows)).toEqual([]);
  });
});
