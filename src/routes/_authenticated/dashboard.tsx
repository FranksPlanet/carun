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
  trackedKm,
  totalLogged,
  consumptionPoints,
  averageConsumption,
  lifetimeBreakdown,
  costPerKmViews,
  type ExpenseRow,
  type CostPerKmMode,
} from "@/lib/calc";
import { useCategories, type CategoryRow } from "@/lib/categories";

import { defaultSettings, formatDistance, formatConsumption, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { t } from "@/lib/strings";
import { VehiclePhoto } from "@/components/vehicle-photo";
import { CostPerKmWidget } from "@/components/cost-per-km-widget";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — RevTab" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchVehicles = useServerFn(listVehicles);
  const fetchExpenses = useServerFn(listExpenses);
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

  const settings = profileQ.data ?? defaultSettings;
  const categoriesQ = useCategories();
  const categories: CategoryRow[] = categoriesQ.data ?? [];
  // Map category role onto each row so calc.ts can identify fuel expenses.
  const expenses = useMemo<ExpenseRow[]>(() => {
    const raw = (expensesQ.data ?? []) as any[];
    const byId = new Map(categories.map((c: CategoryRow) => [c.id, c.role] as const));
    return raw.map((e) => ({ ...e, role: byId.get(e.category_id) ?? e.role ?? "other" }));
  }, [expensesQ.data, categories]);





  const stats = useMemo(() => {
    return {
      km: trackedKm(expenses),
      cpk: costPerKm(expenses),
      total: totalLogged(expenses),
      avgCons: averageConsumption(consumptionPoints(expenses)),
    };
  }, [expenses]);

  if (vehiclesQ.isLoading || profileQ.isLoading || !vehiclesQ.isSuccess) {
    return (
      <div className="space-y-4">
        <div className="aspect-video w-full rounded-2xl bg-muted animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kpi-card h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold mb-2">Welcome to {t.appName}</h1>
        <p className="text-muted-foreground mb-6">{t.empty.noVehicles}</p>
        <Button onClick={() => navigate({ to: "/onboarding" })} className="rounded-full">
          <Plus className="size-4 mr-1" /> Add vehicle
        </Button>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {vehicles.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {vehicles.map((v: any) => (
            <button
              key={v.id}
              onClick={() => setActiveVehicleId(v.id)}
              className={`tag-chip ${v.id === vehicle?.id ? "" : ""}`}
              data-on={v.id === vehicle?.id}
            >
              {v.name}
            </button>
          ))}
          <Link to="/onboarding" className="tag-chip">+ Add</Link>
        </div>
      )}

      {vehicle && (
        <div className="space-y-3">
          <VehiclePhoto
            vehicleId={vehicle.id}
            photoPath={(vehicle as any).photo_path}
            vehicleName={vehicle.name}
          />
          <div className="kpi-card kpi-hero">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <div className="text-xl font-semibold">{vehicle.name}</div>
                <div className="text-sm text-muted-foreground">
                  {vehicle.plate ? `${vehicle.plate} · ` : ""}{cap(vehicle.fuel_type)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="grid grid-cols-2 gap-3">
        <div className="kpi-card">
          <div className="kpi-label">{t.kpi.costPerKm}</div>
          <div className="kpi-value num">{formatCostPerKm(stats.cpk, settings)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t.kpi.avgConsumption}</div>
          <div className="kpi-value num">{formatConsumption(stats.avgCons, settings)}</div>
        </div>
        <div className="kpi-card kpi-tile-sand">
          <div className="kpi-label">Current odometer</div>
          <div className="kpi-value num">{formatDistance(vehicle?.current_odometer_km ?? 0, settings)}</div>
        </div>
        <div className="kpi-card kpi-tile-sand">
          <div className="kpi-label">{t.kpi.loggedTotal}</div>
          <div className="kpi-value num">{formatMoney(stats.total, { ...settings, currency: vehicle?.currency ?? settings.currency })}</div>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="kpi-card text-center py-8">
          <p className="text-muted-foreground">{t.empty.noExpenses}</p>
          <Link to="/expenses" className="inline-block mt-3">
            <Button className="rounded-full"><Plus className="size-4 mr-1" /> Add expense</Button>
          </Link>
        </div>
      ) : (
        <div className="kpi-card">
          <div className="text-sm font-semibold mb-1">Insights</div>
          <p className="text-sm text-muted-foreground">
            Projections, lifetime cost estimates and consumption trends live in{" "}
            <Link to="/insights" className="underline text-foreground">Insights</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

