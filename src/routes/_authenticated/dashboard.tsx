import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVehicles } from "@/lib/vehicles.functions";
import { listExpenses } from "@/lib/expenses.functions";
import { listRecurring } from "@/lib/recurring.functions";
import { listRepairs } from "@/lib/repairs.functions";
import { getProfile } from "@/lib/profile.functions";
import { useMemo, useState } from "react";
import {
  consumptionPoints,
  averageConsumption,
  lifetimeBreakdown,
  costPerKmViews,
  totalLogged,
  type ExpenseRow,
  type CostPerKmMode,
} from "@/lib/calc";
import { useCategories, type CategoryRow, CategoryIcon } from "@/lib/categories";

import { defaultSettings, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, Fuel } from "lucide-react";
import { t } from "@/lib/strings";
import { VehicleHero } from "@/components/vehicle-hero";
import { CostPerKmWidget } from "@/components/cost-per-km-widget";
import { StoryNarrative } from "@/components/story-narrative";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — RevTab" }] }),
  component: Dashboard,
});

function Dashboard() {
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
  const categoriesQ = useCategories();
  const categories: CategoryRow[] = categoriesQ.data ?? [];
  const expenses = useMemo<ExpenseRow[]>(() => {
    const raw = (expensesQ.data ?? []) as any[];
    const byId = new Map(categories.map((c: CategoryRow) => [c.id, c.role] as const));
    return raw.map((e) => ({ ...e, role: byId.get(e.category_id) ?? e.role ?? "other" }));
  }, [expensesQ.data, categories]);

  const recurring = (recurringQ.data ?? []) as { amount_minor_per_year: number }[];
  const repairs = (repairsQ.data ?? []) as { amount_minor: number }[];

  const cpkViews = useMemo(() => {
    if (!vehicle) return null;
    const lt = lifetimeBreakdown(
      {
        purchase_date: vehicle.purchase_date,
        purchase_odometer_km: vehicle.purchase_odometer_km,
        purchase_price_minor: vehicle.purchase_price_minor,
      },
      expenses,
      recurring,
      repairs,
    );
    return costPerKmViews(
      {
        purchase_price_minor: vehicle.purchase_price_minor,
        purchase_odometer_km: vehicle.purchase_odometer_km,
        current_odometer_km: vehicle.current_odometer_km ?? 0,
        estimated_resale_value_minor:
          (vehicle as any).estimated_resale_value_minor ?? null,
      },
      lt.total_minor,
    );
  }, [vehicle, expenses, recurring, repairs]);

  const cpkMode: CostPerKmMode =
    ((profileQ.data as any)?.default_cost_per_km_mode as CostPerKmMode) ?? "with_depreciation";

  // Fuel aggregates (used by the story and the fuel widget)
  const fuel = useMemo(() => {
    const points = consumptionPoints(expenses);
    let liters = 0;
    let fuelAmount = 0;
    for (const e of expenses) {
      if (e.role === "fuel" && e.liters && e.liters > 0) {
        liters += e.liters;
        fuelAmount += e.amount_minor;
      }
    }
    const pricePerLiterMinor = liters > 0 ? fuelAmount / liters : null;
    const avg = averageConsumption(points);
    const total = totalLogged(expenses);
    const fuelSharePct = total > 0 ? (fuelAmount / total) * 100 : null;
    return {
      liters,
      fuelAmount,
      pricePerLiterMinor,
      avg,
      fuelSharePct,
      hasFuel: liters > 0,
    };
  }, [expenses]);

  // Category breakdown by category_id (uses dynamic colours/icons)
  const catBreakdown = useMemo(() => {
    const sums = new Map<string, number>();
    for (const e of expenses) sums.set(e.category_id, (sums.get(e.category_id) ?? 0) + e.amount_minor);
    const items = categories
      .map((c) => ({ c, amount: sums.get(c.id) ?? 0 }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const max = items[0]?.amount ?? 0;
    return { items, max };
  }, [expenses, categories]);

  if (vehiclesQ.isLoading || profileQ.isLoading || !vehiclesQ.isSuccess) {
    return (
      <div className="space-y-4">
        <div className="aspect-video w-full rounded-sm bg-muted animate-pulse" />
        <div className="h-24 rounded-sm bg-muted animate-pulse" />
        <div className="h-48 rounded-sm bg-muted animate-pulse" />
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="display text-3xl mb-2">Welcome to {t.appName}</h1>
        <p className="text-muted-foreground mb-6">{t.empty.noVehicles}</p>
        <Button onClick={() => navigate({ to: "/onboarding" })} variant="accent">
          <Plus className="size-4 mr-1" /> Add vehicle
        </Button>
      </div>
    );
  }

  const cardCurrency = vehicle?.currency ?? settings.currency;
  const cardSettings = { ...settings, currency: cardCurrency };

  return (
    <div className="space-y-6">
      {/* Vehicle switcher */}
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

      {/* One connected "this car" panel */}
      {vehicle && cpkViews && (
        <section className="rounded-sm border border-border bg-card overflow-hidden">
          {/* Header: photo banner with name + wrench menu */}
          <VehicleHero
            flush
            vehicle={{
              id: vehicle.id,
              name: vehicle.name,
              currency: vehicle.currency,
              photo_path: (vehicle as any).photo_path ?? null,
              estimated_resale_value_minor:
                (vehicle as any).estimated_resale_value_minor ?? null,
            }}
          />

          {/* Prominent story */}
          <div className="p-5 sm:p-6 border-b border-border">
            <StoryNarrative
              vehicleId={vehicle.id}
              lifetimeKm={cpkViews.lifetime_km}
              costPerKmMinor={pickCostPerKm(cpkViews, cpkMode)}
              totalLiters={fuel.liters}
              pricePerLiterMinor={fuel.pricePerLiterMinor}
              avgConsumptionLPer100Km={fuel.avg}
              fuelSharePct={fuel.fuelSharePct}
              settings={cardSettings}
              hasAnyExpense={expenses.length > 0}
            />
          </div>

          {/* Nested cost-per-km sub-section */}
          <div
            className="p-4 sm:p-5 border-b border-border"
            style={{ background: "color-mix(in oklab, var(--color-secondary) 55%, var(--color-card))" }}
          >
            <CostPerKmWidget
              views={cpkViews}
              mode={cpkMode}
              settings={cardSettings}
              bare
            />

            {catBreakdown.items.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="kpi-label mb-2">Where it goes</div>
                <ul className="space-y-2">
                  {catBreakdown.items.slice(0, 6).map(({ c, amount }) => {
                    const pct = catBreakdown.max > 0 ? (amount / catBreakdown.max) * 100 : 0;
                    return (
                      <li key={c.id} className="flex items-center gap-3">
                        <CategoryIcon category={c} className="size-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm truncate">{c.name}</span>
                            <span className="text-xs num text-muted-foreground">
                              {formatMoney(amount, cardSettings)}
                            </span>
                          </div>
                          <div
                            className="mt-1 h-1.5 overflow-hidden rounded-sm"
                            style={{ background: "color-mix(in oklab, var(--color-foreground) 6%, transparent)" }}
                          >
                            <div
                              className="h-full rounded-sm"
                              style={{ width: `${pct}%`, background: c.color }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Link to="/expenses">
                <Button variant="ghost" size="sm">
                  View expenses <ArrowRight className="size-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Nested fuel sub-section */}
          <div
            className="p-4 sm:p-5"
            style={{ background: "color-mix(in oklab, var(--color-secondary) 30%, var(--color-card))" }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Fuel className="size-4 text-foreground" />
                <div className="kpi-label">Fuel</div>
              </div>
              <Link to="/insights">
                <Button variant="ghost" size="sm">
                  View insights <ArrowRight className="size-4 ml-1" />
                </Button>
              </Link>
            </div>

            {fuel.hasFuel ? (
              <div className="grid grid-cols-2 gap-3">
                <FuelStat
                  label="Total fuel"
                  value={`${Math.round(fuel.liters).toLocaleString("cs-CZ").replace(/[\s\u202F]/g, "\u00A0")}\u00A0l`}
                />
                <FuelStat
                  label="Avg price"
                  value={
                    fuel.pricePerLiterMinor != null
                      ? formatPricePerLiterLocal(fuel.pricePerLiterMinor, cardSettings.currency)
                      : "—"
                  }
                />
                <FuelStat
                  label="Consumption"
                  value={fuel.avg != null ? `${fuel.avg.toFixed(2).replace(".", ",")}\u00A0l/100km` : "—"}
                />
                <FuelStat
                  label="Share of cost"
                  value={fuel.fuelSharePct != null ? `${fuel.fuelSharePct.toFixed(0)}\u00A0%` : "—"}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Log a fuel fill-up to see your consumption and share of cost.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Add another car — extra bottom padding so the fixed Add-expense
          button never clashes with it. */}
      <div className="pt-2 pb-24 flex justify-center">
        <Link to="/onboarding">
          <Button variant="outline">
            <Plus className="size-4 mr-1" /> Add another car
          </Button>
        </Link>
      </div>
    </div>
  );
}

function pickCostPerKm(
  views: { operating_minor_per_km: number; with_depreciation_minor_per_km: number | null; with_full_purchase_minor_per_km: number },
  mode: CostPerKmMode,
): number | null {
  if (mode === "operating") return views.operating_minor_per_km;
  if (mode === "with_full_purchase") return views.with_full_purchase_minor_per_km;
  // depreciation falls back to operating if no resale set
  return views.with_depreciation_minor_per_km ?? views.operating_minor_per_km;
}

function FuelStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold num mt-0.5">{value}</div>
    </div>
  );
}

function formatPricePerLiterLocal(minorPerLiter: number, currency: string): string {
  const symbols: Record<string, string> = { CZK: "Kč", EUR: "€", USD: "$", GBP: "£" };
  const major = minorPerLiter / 100;
  const num = major.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\s\u202F]/g, "\u00A0");
  return `${num}\u00A0${symbols[currency] ?? currency}/l`;
}
