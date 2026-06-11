import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useServerFn } from "@tanstack/react-query" as never;
import { useServerFn as useSF } from "@tanstack/react-start";
import { listVehicles } from "@/lib/vehicles.functions";
import { listExpenses } from "@/lib/expenses.functions";
import { getProfile } from "@/lib/profile.functions";
import { useQuery as useRQ } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  costPerKm,
  trackedKm,
  totalLogged,
  consumptionPoints,
  averageConsumption,
  categoryCostPerKm,
  cumulativeSpend,
} from "@/lib/calc";
import { defaultSettings, formatCostPerKm, formatDistance, formatConsumption, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { t } from "@/lib/strings";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — RunningCost" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchVehicles = useSF(listVehicles);
  const fetchExpenses = useSF(listExpenses);
  const fetchProfile = useSF(getProfile);

  const profileQ = useRQ({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const vehiclesQ = useRQ({ queryKey: ["vehicles"], queryFn: () => fetchVehicles() });
  const vehicles = vehiclesQ.data ?? [];
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const vehicle = vehicles.find((v) => v.id === activeVehicleId) ?? vehicles[0];

  const expensesQ = useRQ({
    queryKey: ["expenses", vehicle?.id],
    queryFn: () => fetchExpenses({ data: { vehicle_id: vehicle!.id } }),
    enabled: !!vehicle,
  });

  const settings = profileQ.data ?? defaultSettings;
  const expenses = (expensesQ.data ?? []) as never[];

  const stats = useMemo(() => {
    return {
      km: trackedKm(expenses),
      cpk: costPerKm(expenses),
      total: totalLogged(expenses),
      avgCons: averageConsumption(consumptionPoints(expenses)),
      byCat: categoryCostPerKm(expenses),
      cum: cumulativeSpend(expenses).map((p) => ({ date: p.date, total: p.total / 100 })),
    };
  }, [expenses]);

  if (vehiclesQ.isLoading || profileQ.isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="font-display text-2xl mb-2">Welcome to {t.appName}</h1>
        <p className="text-muted-foreground mb-6">{t.empty.noVehicles}</p>
        <Button onClick={() => navigate({ to: "/onboarding" })}>
          <Plus className="size-4 mr-1" /> Add vehicle
        </Button>
      </div>
    );
  }

  const catColors: Record<string, string> = {
    fuel: "var(--color-chart-2)",
    service: "var(--color-chart-1)",
    admin: "var(--color-chart-3)",
    other: "var(--color-chart-5)",
  };
  const catData = Object.entries(stats.byCat)
    .map(([k, v]) => ({ name: k, value: v }))
    .filter((x) => x.value > 0);

  return (
    <div className="space-y-6">
      {vehicles.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {vehicles.map((v) => (
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card kpi-hero">
          <div className="kpi-label">{t.kpi.costPerKm}</div>
          <div className="kpi-value">{formatCostPerKm(stats.cpk, settings)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t.kpi.trackedDistance}</div>
          <div className="kpi-value">{formatDistance(stats.km, settings)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t.kpi.avgConsumption}</div>
          <div className="kpi-value">{formatConsumption(stats.avgCons, settings)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t.kpi.loggedTotal}</div>
          <div className="kpi-value">{formatMoney(stats.total, settings)}</div>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="kpi-card text-center py-8">
          <p className="text-muted-foreground">{t.empty.noExpenses}</p>
          <Link to="/expenses" className="inline-block mt-3">
            <Button><Plus className="size-4 mr-1" /> Add expense</Button>
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="kpi-card">
            <div className="kpi-label mb-2">Cost split</div>
            <div className="h-48">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} stroke="none">
                    {catData.map((d) => (
                      <Cell key={d.name} fill={catColors[d.name]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
                    formatter={(v: number, n: string) => [formatCostPerKm(v, settings), n]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label mb-2">Cumulative spend</div>
            <div className="h-48">
              <ResponsiveContainer>
                <AreaChart data={stats.cum}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                  <Area type="monotone" dataKey="total" stroke="var(--color-primary)" fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        More screens (Expenses, Fuel, Projection, Garage, Onboarding, Settings) are scaffolded — see the build notes.
      </div>
    </div>
  );
}
