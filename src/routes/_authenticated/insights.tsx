import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ErrorState, errorMessage } from "@/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  Scatter,
  ComposedChart,
} from "recharts";
import { listVehicles } from "@/lib/vehicles.functions";
import { listExpenses } from "@/lib/expenses.functions";
import { detectAnomalies, flaggedPointCount } from "@/lib/anomalies";

import { listRecurring } from "@/lib/recurring.functions";
import { listRepairs } from "@/lib/repairs.functions";
import { getProfile } from "@/lib/profile.functions";
import { useCategories, type CategoryRow } from "@/lib/categories";

import {
  consumptionSeries,
  segmentedAverages,
  averageConsumption,
  pricePerUnitSeries,
  lifetimeBreakdown,
  projection,
  defaultAnnualKm,
  defaultFuelPriceMinorForCategory,
  defaultMaintenancePerKm,
  type ExpenseRow,
} from "@/lib/calc";
import { applyVatView, vatSplit } from "@/lib/vat";
import {
  defaultSettings,
  formatConsumption,
  formatCostPerKm,
  formatDistance,
  formatMoney,
  formatPricePerLiter,
  formatPricePerUnit,
  formatConsumptionUnit,
  moneyMajorToMinor,
  moneyMinorToMajor,
  type ProfileSettings,
} from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Plus, AlertTriangle } from "lucide-react";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — RevTab" }] }),
  component: InsightsPage,
});


function InsightsPage() {
  const navigate = useNavigate();
  const fetchVehicles = useServerFn(listVehicles);
  const fetchExpenses = useServerFn(listExpenses);
  const fetchRecurring = useServerFn(listRecurring);
  const fetchRepairs = useServerFn(listRepairs);
  const fetchProfile = useServerFn(getProfile);

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const vehiclesQ = useQuery({ queryKey: ["vehicles"], queryFn: () => fetchVehicles() });
  const vehicles = vehiclesQ.data ?? [];
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const vehicle = vehicles.find((v: any) => v.id === activeVehicleId) ?? vehicles[0];

  // Scroll to hash target after sections render (TanStack Router scrolls before
  // async data loads, so the element may not exist yet).
  const hasScrolledToHash = useRef(false);
  useEffect(() => {
    if (hasScrolledToHash.current) return;
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.slice(1);
    const interval = setInterval(() => {
      const el = document.getElementById(id);
      if (el) {
        hasScrolledToHash.current = true;
        clearInterval(interval);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 200);
    const timeout = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const expensesQ = useQuery({
    queryKey: ["expenses", vehicle?.id],
    queryFn: () => fetchExpenses({ data: { vehicle_id: vehicle!.id } }),
    enabled: !!vehicle,
  });
  const recurringQ = useQuery({
    queryKey: ["recurring", vehicle?.id],
    queryFn: () => fetchRecurring({ data: { vehicle_id: vehicle!.id } }),
    enabled: !!vehicle,
  });
  const repairsQ = useQuery({
    queryKey: ["repairs", vehicle?.id],
    queryFn: () => fetchRepairs({ data: { vehicle_id: vehicle!.id } }),
    enabled: !!vehicle,
  });

  const categoriesQ = useCategories();
  const categories: CategoryRow[] = categoriesQ.data ?? [];

  const settings = profileQ.data ?? defaultSettings;
  const currency = vehicle?.currency ?? settings.currency;
  const moneySettings = { ...settings, currency };
  const exVat = Boolean((profileQ.data as any)?.show_prices_ex_vat);
  // Map the joined category role onto every row. The server already flattens
  // role, but we re-map from the local categories list as a belt-and-braces
  // guarantee — calc.ts identifies fuel by `role === 'fuel'`, so a missing
  // role would blank out consumption, fuel rate, and maintenance/km.
  const expenses = useMemo<ExpenseRow[]>(() => {
    const raw = (expensesQ.data ?? []) as any[];
    const byId = new Map(categories.map((c: CategoryRow) => [c.id, c.role] as const));
    const mapped = raw.map((e) => ({ ...e, role: byId.get(e.category_id) ?? e.role ?? "other" }));
    // VAT view applied before calc.ts sees anything — calc stays VAT-unaware.
    return applyVatView(mapped, exVat);
  }, [expensesQ.data, categories, exVat]);

  const recurring = (recurringQ.data ?? []) as { amount_minor_per_year: number }[];
  const repairs = (repairsQ.data ?? []) as { amount_minor: number }[];

  // The purchase price participates in the VAT view too.
  const vehicleV = useMemo(() => {
    if (!vehicle) return vehicle;
    if (!exVat) return vehicle;
    const net = vatSplit(
      vehicle.purchase_price_minor,
      (vehicle as any).purchase_vat_rate ?? null,
    ).net;
    return { ...vehicle, purchase_price_minor: net };
  }, [vehicle, exVat]);


  const fuelSeries = useMemo(
    () => consumptionSeries(expenses, categories as any),
    [expenses, categories],
  );

  const lifetime = useMemo(
    () =>
      vehicleV
        ? lifetimeBreakdown(
            {
              purchase_date: vehicleV.purchase_date,
              purchase_odometer_km: vehicleV.purchase_odometer_km,
              purchase_price_minor: vehicleV.purchase_price_minor,
            },
            expenses,
            recurring,
            repairs,
          )
        : null,
    [vehicleV, expenses, recurring, repairs],
  );

  // Anomaly detection runs on the raw (gross, pre-VAT-view) rows: it is about
  // odometers, dates and consumption, none of which the VAT view changes.
  const anomalies = useMemo(() => {
    const raw = (expensesQ.data ?? []) as any[];
    if (raw.length === 0 || categories.length === 0)
      return { flags: [] as ReturnType<typeof detectAnomalies>, flaggedByCategory: {} as Record<string, number> };
    const byId = new Map(categories.map((c: CategoryRow) => [c.id, c.role] as const));
    const mapped = raw.map((e) => ({ ...e, role: byId.get(e.category_id) ?? e.role ?? "other" }));
    const series = consumptionSeries(mapped as any, categories as any);
    const flags = detectAnomalies(mapped as any, series, categories as any);
    const flaggedByCategory: Record<string, number> = {};
    for (const s of series)
      flaggedByCategory[s.category_id] = flaggedPointCount(s, mapped as any, flags);
    return { flags, flaggedByCategory };
  }, [expensesQ.data, categories]);

  const fuelFlagCount = anomalies.flags.filter(
    (f) => f.kind !== "duplicate" && f.kind !== "odometer_backwards",
  ).length;

  // One bundle of derived chart data per fuel-role category.
  const seriesViews = useMemo(
    () =>
      fuelSeries.map((s) => ({
        category_id: s.category_id,
        name: s.category_name,
        unit: s.unit,
        segAvg: segmentedAverages(s.points),
        overallAvg: averageConsumption(s.points),
        flaggedPoints: anomalies.flaggedByCategory[s.category_id] ?? 0,
        consChartData: s.points.map((p) => ({
          date: p.date,
          per_100km: Number(p.per_100km.toFixed(2)),
          spike: p.is_spike ? Number(p.per_100km.toFixed(2)) : null,
          is_loaded: p.is_loaded,
        })),
        priceSeries: pricePerUnitSeries(expenses, s.category_id).map((p) => ({
          date: p.date,
          price_major: moneyMinorToMajor(p.price, currency),
          price_minor: p.price,
        })),
      })),
    [fuelSeries, expenses, currency, anomalies],
  );


  if (vehiclesQ.isError) {
    return (
      <ErrorState
        title="Couldn't load Insights"
        message={errorMessage(vehiclesQ.error)}
        onRetry={() => vehiclesQ.refetch()}
        retrying={vehiclesQ.isFetching}
      />
    );
  }

  if (vehiclesQ.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="kpi-card h-24 animate-pulse" />
          <div className="kpi-card h-24 animate-pulse" />
        </div>
        <div className="kpi-card h-64 animate-pulse" />
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold mb-2">Insights</h1>
        <p className="text-muted-foreground mb-6">{t.empty.noVehicles}</p>
        <Button onClick={() => navigate({ to: "/onboarding" })}>
          <Plus className="size-4 mr-1" /> Add vehicle
        </Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Insights</h1>
      </div>

      {vehicles.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {vehicles.map((v: any) => (
            <button
              key={v.id}
              onClick={() => setActiveVehicleId(v.id)}
              className="tag-chip"
              data-on={v.id === vehicle?.id}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {anomalies.flags.length > 0 && (
        <div className="kpi-card border-l-2" style={{ borderLeftColor: "var(--color-accent)" }}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {anomalies.flags.length === 1
                  ? "1 entry looks worth a check"
                  : `${anomalies.flags.length} entries look worth a check`}
                {fuelFlagCount > 0 && anomalies.flags.length !== fuelFlagCount
                  ? ` (${fuelFlagCount} fuel)`
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Nothing has been changed or removed — these are still counted in every figure
                below. Open them to see what looks off and why.
              </p>
              <Link
                to="/expenses"
                hash="flagged"
                className="inline-block mt-2 text-xs font-semibold underline underline-offset-4"
              >
                Review in Expenses
              </Link>
            </div>
          </div>
        </div>
      )}

      {seriesViews.length === 0 && (
        <div id="consumption" className="kpi-card">
          <div className="kpi-label mb-2">Consumption</div>
          <p className="text-sm text-muted-foreground">{t.empty.needFuel}</p>
        </div>
      )}


      {seriesViews.map((sv, idx) => (
        <div key={sv.category_id} className="space-y-6">
          {/* Segmented averages */}
          <div className="grid grid-cols-2 gap-3">
            <div className="kpi-card">
              <div className="kpi-label">{t.kpi.cleanAvg}</div>
              <KpiValue value={formatConsumptionUnit(sv.segAvg.clean, sv.unit, settings)} />
              <div className="text-xs text-muted-foreground mt-1">Untagged fills</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">{t.kpi.loadedAvg}</div>
              <KpiValue value={formatConsumptionUnit(sv.segAvg.loaded, sv.unit, settings)} />
              <div className="text-xs text-muted-foreground mt-1">
                Towing · Fully loaded · Roof box
              </div>
            </div>
          </div>

          {/* Consumption trend */}
          <div id={idx === 0 ? "consumption" : undefined} className="kpi-card">
            <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
              <div className="kpi-label">
                {sv.name} consumption ({sv.unit} / 100 km)
              </div>
              {sv.overallAvg != null && (
                <div className="text-xs text-muted-foreground">
                  Avg {formatConsumptionUnit(sv.overallAvg, sv.unit, settings)}
                </div>
              )}
            </div>
            <div className="h-64">
              {sv.consChartData.length === 0 ? (
                <div className="h-full grid place-items-center text-muted-foreground text-sm text-center px-6">
                  {t.empty.needFuel}
                </div>
              ) : (
                <ResponsiveContainer>
                  <ComposedChart data={sv.consChartData}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    />
                    <YAxis
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                      }}
                      formatter={(v: any) =>
                        v == null ? "—" : `${v} ${sv.unit} / 100 km`
                      }
                    />
                    {sv.overallAvg != null && (
                      <ReferenceLine
                        y={Number(sv.overallAvg.toFixed(2))}
                        stroke="var(--color-muted-foreground)"
                        strokeDasharray="3 3"
                        label={{
                          value: "avg",
                          fill: "var(--color-muted-foreground)",
                          fontSize: 10,
                          position: "right",
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="per_100km"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--color-primary)" }}
                      activeDot={{ r: 5 }}
                    />
                    <Scatter dataKey="spike" fill="var(--color-destructive)" shape="circle" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Tagged loads (towing, roof box, fully loaded) are expected to read higher. An
              untagged spike — highlighted — may be worth a check.
            </p>
          </div>

          {/* Price paid */}
          <div className="kpi-card">
            <div className="kpi-label mb-2">{sv.name} price paid</div>
            <div className="h-56">
              {sv.priceSeries.length === 0 ? (
                <div className="h-full grid place-items-center text-muted-foreground text-sm text-center px-6">
                  {t.empty.needFuel}
                </div>
              ) : (
                <ResponsiveContainer>
                  <LineChart data={sv.priceSeries}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    />
                    <YAxis
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                      }}
                      formatter={(_v: any, _n: any, item: any) =>
                        formatPricePerUnit(
                          item?.payload?.price_minor ?? 0,
                          sv.unit,
                          moneySettings,
                        )
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="price_major"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--color-primary)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Lifetime cost */}
      {lifetime && (
        <div id="lifetime" className="kpi-card">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
            <div className="kpi-label">
              Lifetime cost (with backfill) · {exVat ? "excl. VAT" : "incl. VAT"}
            </div>
            <div className="text-xs text-muted-foreground">
              Gap: {formatDistance(lifetime.gap_km, settings)} ·{" "}
              {lifetime.gap_years.toFixed(1)} yr
            </div>
          </div>

          {lifetime.gap_km === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pre-tracking gap to estimate — tracking began at purchase.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">
              Fuel cost per km used for backfill:{" "}
              {formatCostPerKm(lifetime.per_km_variable_minor, moneySettings)}
            </p>
          )}

          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Actual
              </div>
              <ul className="text-sm divide-y divide-border rounded-md border border-border">
                <li className="flex justify-between px-3 py-2">
                  <span>Purchase price</span>
                  <span className="tabular-nums">
                    {formatMoney(lifetime.purchase_price_minor, moneySettings)}
                  </span>
                </li>
                <li className="flex justify-between px-3 py-2">
                  <span>Logged expenses total</span>
                  <span className="tabular-nums">
                    {formatMoney(lifetime.logged_total_minor, moneySettings)}
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Estimated
              </div>
              <ul className="text-sm rounded-md border border-dashed border-border bg-muted/30 divide-y divide-border/70">
                <li className="flex justify-between px-3 py-2">
                  <span>
                    Recurring across tracked years{" "}
                    <span className="text-muted-foreground">
                      ({lifetime.tracked_years.toFixed(1)} yr)
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {t.est}{" "}
                    {formatMoney(lifetime.recurring_tracked_minor, moneySettings)}
                  </span>
                </li>
                {lifetime.gap_km > 0 && (
                  <li className="flex justify-between px-3 py-2">
                    <span>Backfilled running cost (pre-tracking)</span>
                    <span className="tabular-nums">
                      {t.est}{" "}
                      {formatMoney(lifetime.backfilled_running_minor, moneySettings)}
                    </span>
                  </li>
                )}
                {lifetime.gap_years > 0 && (
                  <li className="flex justify-between px-3 py-2">
                    <span>Backfilled yearly costs (pre-tracking)</span>
                    <span className="tabular-nums">
                      {t.est}{" "}
                      {formatMoney(lifetime.backfilled_yearly_minor, moneySettings)}
                    </span>
                  </li>
                )}
                <li className="flex justify-between px-3 py-2">
                  <span>Remembered repairs</span>
                  <span className="tabular-nums">
                    ≈ {formatMoney(lifetime.remembered_repairs_minor, moneySettings)}
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex justify-between items-baseline pt-2 border-t border-border">
              <span className="text-base font-semibold">Lifetime total</span>
              <span className="tabular-nums text-lg font-semibold">
                {formatMoney(lifetime.total_minor, moneySettings)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Estimates recompute automatically as more real data is logged.
          </p>
        </div>
      )}

      {vehicle && (
        <ProjectionSection
          vehicle={vehicleV}
          expenses={expenses}
          categories={categories}
          recurring={recurring}
          settings={settings}
          moneySettings={moneySettings}
          currency={currency}
        />
      )}

    </div>
  );
}

type ProjectionProps = {
  vehicle: any;
  expenses: ExpenseRow[];
  categories: CategoryRow[];
  recurring: { amount_minor_per_year: number }[];
  settings: ProfileSettings;
  moneySettings: ProfileSettings;
  currency: string;
};



function ProjectionSection({
  vehicle,
  expenses,
  categories,
  recurring,
  settings,
  moneySettings,
  currency,
}: ProjectionProps) {
  const defAnnualKm = useMemo(() => defaultAnnualKm(expenses), [expenses]);
  const defMaintPerKm = useMemo(() => defaultMaintenancePerKm(expenses), [expenses]);

  // One price control per fuel-role category that actually has fill-ups.
  const fuelSeries = useMemo(
    () => consumptionSeries(expenses, categories as any),
    [expenses, categories],
  );
  const defaultPricesMinor = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of fuelSeries) {
      m[s.category_id] =
        defaultFuelPriceMinorForCategory(expenses, s.category_id) ||
        moneyMajorToMinor(40, currency);
    }
    return m;
  }, [fuelSeries, expenses, currency]);

  const [annualKm, setAnnualKm] = useState<number>(defAnnualKm);
  const [pricesMajor, setPricesMajor] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const k of Object.keys(defaultPricesMinor))
      m[k] = moneyMinorToMajor(defaultPricesMinor[k], currency);
    return m;
  });
  const [horizon, setHorizon] = useState<number>(5);
  const [maintMajorPerKm, setMaintMajorPerKm] = useState<number>(
    moneyMinorToMajor(defMaintPerKm, currency),
  );

  // Re-seed defaults when vehicle/data changes meaningfully
  useEffect(() => {
    setAnnualKm(defAnnualKm);
  }, [defAnnualKm, vehicle?.id]);
  useEffect(() => {
    const m: Record<string, number> = {};
    for (const k of Object.keys(defaultPricesMinor))
      m[k] = moneyMinorToMajor(defaultPricesMinor[k], currency);
    setPricesMajor(m);
  }, [defaultPricesMinor, currency, vehicle?.id]);
  useEffect(() => {
    setMaintMajorPerKm(moneyMinorToMajor(defMaintPerKm, currency));
  }, [defMaintPerKm, currency, vehicle?.id]);

  const maintMinorPerKm = moneyMajorToMinor(maintMajorPerKm, currency);

  const sourcesInput = useMemo(
    () =>
      fuelSeries.map((s) => ({
        category_id: s.category_id,
        price_per_unit_minor: moneyMajorToMinor(
          pricesMajor[s.category_id] ??
            moneyMinorToMajor(defaultPricesMinor[s.category_id] ?? 0, currency),
          currency,
        ),
      })),
    [fuelSeries, pricesMajor, defaultPricesMinor, currency],
  );

  const result = useMemo(
    () =>
      projection(
        {
          purchase_date: vehicle.purchase_date,
          purchase_odometer_km: vehicle.purchase_odometer_km,
          purchase_price_minor: vehicle.purchase_price_minor,
        },
        expenses,
        categories as any,
        recurring,
        {
          annual_km: annualKm,
          sources: sourcesInput,
          horizon_years: horizon,
          maintenance_minor_per_km: maintMinorPerKm,
        },
      ),
    [vehicle, expenses, categories, recurring, annualKm, sourcesInput, horizon, maintMinorPerKm],
  );

  const purchaseKnown = vehicle.purchase_price_minor > 0;

  const chartData = result.points.map((p) => ({
    year: p.year,
    total: moneyMinorToMajor(p.cumulative_minor, currency),
    fuel: moneyMinorToMajor(p.fuel_cumulative_minor, currency),
    purchase: purchaseKnown ? moneyMinorToMajor(p.purchase_price_minor, currency) : null,
  }));

  const crossoverPoint =
    result.crossover_year != null
      ? chartData.find((d) => d.year === result.crossover_year)
      : null;

  return (
    <div className="kpi-card">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <div className="kpi-label">Projection</div>
        <div className="text-xs text-muted-foreground">
          {result.sources.length === 0
            ? "Log a fuel fill-up for a consumption-based estimate"
            : result.sources
                .map(
                  (s) =>
                    `${s.category_name}: ${formatConsumptionUnit(
                      s.consumption_per_100km,
                      s.unit,
                      settings,
                    )}${s.using_measured_consumption ? "" : " (default)"}`,
                )
                .join(" · ")}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-5 mb-5">
        <SliderRow
          label="Annual distance"
          value={formatDistance(annualKm, settings)}
        >
          <Slider
            min={3000}
            max={50000}
            step={500}
            value={[annualKm]}
            onValueChange={(v) => setAnnualKm(v[0])}
            aria-label="Annual distance"
          />
        </SliderRow>

        {fuelSeries.map((fs) => {
          const baseMajor = moneyMinorToMajor(
            defaultPricesMinor[fs.category_id] ?? moneyMajorToMinor(40, currency),
            currency,
          );
          const valMajor = pricesMajor[fs.category_id] ?? baseMajor;
          return (
            <SliderRow
              key={fs.category_id}
              label={`${fs.category_name} price`}
              value={formatPricePerUnit(
                moneyMajorToMinor(valMajor, currency),
                fs.unit,
                moneySettings,
              )}
            >
              <Slider
                min={Math.max(0.01, baseMajor * 0.5)}
                max={Math.max(0.02, baseMajor * 1.5)}
                step={0.01}
                value={[valMajor]}
                onValueChange={(v) =>
                  setPricesMajor((prev) => ({ ...prev, [fs.category_id]: v[0] }))
                }
                aria-label={`${fs.category_name} price`}
              />
            </SliderRow>
          );
        })}

        <SliderRow label="Horizon" value={`${horizon} yr`}>
          <Slider
            min={1}
            max={15}
            step={1}
            value={[horizon]}
            onValueChange={(v) => setHorizon(v[0])}
          />
        </SliderRow>

        <SliderRow
          label="Maintenance & other"
          value={formatCostPerKm(maintMinorPerKm, moneySettings)}
        >
          <Slider
            min={0}
            max={Math.max(0.5, moneyMinorToMajor(defMaintPerKm, currency) * 3 || 5)}
            step={0.01}
            value={[maintMajorPerKm]}
            onValueChange={(v) => setMaintMajorPerKm(v[0])}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Rough average skewed by one-off repairs — adjust to taste.
          </p>
        </SliderRow>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="year"
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
              tickFormatter={(y) => `Y${y}`}
            />
            <YAxis
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
              }
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
              }}
              formatter={(v: any) =>
                v == null
                  ? "—"
                  : formatMoney(moneyMajorToMinor(Number(v), currency), moneySettings)
              }
              labelFormatter={(y) => `Year ${y}`}
            />
            {purchaseKnown && (
              <ReferenceLine
                y={moneyMinorToMajor(vehicle.purchase_price_minor, currency)}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="3 3"
                label={{
                  value: "purchase price",
                  fill: "var(--color-muted-foreground)",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="total"
              name="Cumulative total"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="fuel"
              name="Cumulative fuel"
              stroke="var(--color-chart-2, var(--color-accent))"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
            />
            {crossoverPoint && (
              <ReferenceDot
                x={crossoverPoint.year}
                y={crossoverPoint.fuel}
                r={5}
                fill="var(--color-destructive)"
                stroke="var(--color-card)"
                strokeWidth={2}
                label={{
                  value: `crossover Y${crossoverPoint.year}`,
                  fill: "var(--color-foreground)",
                  fontSize: 10,
                  position: "top",
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Kpi
          label={`Total over ${horizon} yr`}
          value={formatMoney(result.total_horizon_minor, moneySettings)}
        />
        <Kpi
          label="Avg per year"
          value={formatMoney(result.avg_per_year_minor, moneySettings)}
        />
        <Kpi
          label="Fuel cost / km"
          value={formatCostPerKm(result.fuel_minor_per_km, moneySettings)}
        />
        <Kpi
          label="Crossover"
          value={
            !purchaseKnown
              ? "needs purchase price"
              : result.crossover_year != null
                ? `Year ${result.crossover_year}`
                : "beyond horizon"
          }
        />
      </div>

      {purchaseKnown && result.crossover_year != null && (
        <p className="text-sm mt-4 text-foreground/80">
          Around year {result.crossover_year}, what you've spent on fuel overtakes
          what the car cost to buy — the part of ownership most people never see.
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        These are adjustable assumptions to stress-test, not a fixed prediction.
      </p>
    </div>
  );
}

function KpiValue({ value }: { value: string }) {
  const parts = value.split(/[\s\u00A0]+/);
  if (parts.length < 2) return <div className="kpi-value">{value}</div>;
  return (
    <>
      <div className="kpi-value">{parts[0]}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{parts.slice(1).join(" ")}</div>
    </>
  );
}

function SliderRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

