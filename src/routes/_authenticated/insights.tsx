import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Scatter,
  ComposedChart,
} from "recharts";
import { listVehicles } from "@/lib/vehicles.functions";
import { listExpenses } from "@/lib/expenses.functions";
import { listRecurring } from "@/lib/recurring.functions";
import { listRepairs } from "@/lib/repairs.functions";
import { getProfile } from "@/lib/profile.functions";
import {
  consumptionPoints,
  segmentedAverages,
  averageConsumption,
  pricePerLiterSeries,
  lifetimeBreakdown,
  type ExpenseRow,
} from "@/lib/calc";
import {
  defaultSettings,
  formatConsumption,
  formatCostPerKm,
  formatDistance,
  formatMoney,
  formatPricePerLiter,
  moneyMinorToMajor,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — RunningCost" }] }),
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

  const settings = profileQ.data ?? defaultSettings;
  const currency = vehicle?.currency ?? settings.currency;
  const moneySettings = { ...settings, currency };
  const expenses = (expensesQ.data ?? []) as ExpenseRow[];
  const recurring = (recurringQ.data ?? []) as { amount_minor_per_year: number }[];
  const repairs = (repairsQ.data ?? []) as { amount_minor: number }[];

  const points = useMemo(() => consumptionPoints(expenses), [expenses]);
  const segAvg = useMemo(() => segmentedAverages(points), [points]);
  const overallAvg = useMemo(() => averageConsumption(points), [points]);

  const lifetime = useMemo(
    () =>
      vehicle
        ? lifetimeBreakdown(
            {
              purchase_date: vehicle.purchase_date,
              purchase_odometer_km: vehicle.purchase_odometer_km,
              purchase_price_minor: vehicle.purchase_price_minor,
            },
            expenses,
            recurring,
            repairs,
          )
        : null,
    [vehicle, expenses, recurring, repairs],
  );

  const consChartData = useMemo(
    () =>
      points.map((p) => ({
        date: p.date,
        l_per_100km: Number(p.l_per_100km.toFixed(2)),
        spike: p.is_spike ? Number(p.l_per_100km.toFixed(2)) : null,
        is_loaded: p.is_loaded,
      })),
    [points],
  );

  const priceSeries = useMemo(
    () =>
      pricePerLiterSeries(expenses).map((p) => ({
        date: p.date,
        price_major: moneyMinorToMajor(p.price, currency),
        price_minor: p.price,
      })),
    [expenses, currency],
  );

  if (vehiclesQ.isLoading) return <p className="text-muted-foreground">Loading…</p>;

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="font-display text-2xl mb-2">Insights</h1>
        <p className="text-muted-foreground mb-6">{t.empty.noVehicles}</p>
        <Button onClick={() => navigate({ to: "/onboarding" })}>
          <Plus className="size-4 mr-1" /> Add vehicle
        </Button>
      </div>
    );
  }

  const hasConsumption = points.length >= 1;
  const hasPrice = priceSeries.length >= 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="font-display text-2xl">Insights</h1>
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

      {/* Segmented averages */}
      <div className="grid grid-cols-2 gap-3">
        <div className="kpi-card">
          <div className="kpi-label">{t.kpi.cleanAvg}</div>
          <div className="kpi-value">{formatConsumption(segAvg.clean, settings)}</div>
          <div className="text-xs text-muted-foreground mt-1">Untagged fills</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t.kpi.loadedAvg}</div>
          <div className="kpi-value">{formatConsumption(segAvg.loaded, settings)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Towing · Fully loaded · Roof box
          </div>
        </div>
      </div>

      {/* Consumption trend */}
      <div className="kpi-card">
        <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
          <div className="kpi-label">Consumption trend (l/100km)</div>
          {overallAvg != null && (
            <div className="text-xs text-muted-foreground">
              Avg {formatConsumption(overallAvg, settings)}
            </div>
          )}
        </div>
        <div className="h-64">
          {!hasConsumption ? (
            <div className="h-full grid place-items-center text-muted-foreground text-sm text-center px-6">
              {t.empty.needFuel}
            </div>
          ) : (
            <ResponsiveContainer>
              <ComposedChart data={consChartData}>
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
                  formatter={(v: any) => (v == null ? "—" : `${v} l/100km`)}
                />
                {overallAvg != null && (
                  <ReferenceLine
                    y={Number(overallAvg.toFixed(2))}
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
                  dataKey="l_per_100km"
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

      {/* Fuel price paid */}
      <div className="kpi-card">
        <div className="kpi-label mb-2">Fuel price paid</div>
        <div className="h-56">
          {!hasPrice ? (
            <div className="h-full grid place-items-center text-muted-foreground text-sm text-center px-6">
              {t.empty.needFuel}
            </div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={priceSeries}>
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
                    formatPricePerLiter(item?.payload?.price_minor ?? 0, moneySettings)
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

      {/* Lifetime cost */}
      {lifetime && (
        <div className="kpi-card">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
            <div className="kpi-label">Lifetime cost (with backfill)</div>
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
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
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
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
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
              <span className="font-display text-base">Lifetime total</span>
              <span className="tabular-nums font-display text-lg">
                {formatMoney(lifetime.total_minor, moneySettings)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Estimates recompute automatically as more real data is logged.
          </p>
        </div>
      )}

      <div className="kpi-card opacity-75">
        <div className="kpi-label">Projection</div>
        <p className="text-sm text-muted-foreground mt-1">Coming soon.</p>
      </div>
    </div>
  );
}
