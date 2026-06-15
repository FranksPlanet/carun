import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_META, CategoryIcon } from "@/lib/categories";
import { listVehicles } from "@/lib/vehicles.functions";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/lib/expenses.functions";
import { getProfile } from "@/lib/profile.functions";
import {
  consumptionPoints,
  totalsByCategory,
  totalLogged,
  cumulativeSpend,
  CONTEXT_TAGS,
  type ExpenseRow,
} from "@/lib/calc";
import {
  defaultSettings,
  formatMoney,
  formatDistance,
  formatConsumption,
  formatVolume,
  moneyMajorToMinor,
  moneyMinorToMajor,
  parseLocalNumber,
  currencySymbolFor,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/strings";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — RevTab" }] }),
  component: ExpensesPage,
});

type Category = "fuel" | "service" | "admin" | "other";

type FormState = {
  id?: string;
  date: string;
  odometer: string;
  category: Category;
  amount: string;
  liters: string;
  full_tank: boolean;
  tags: string[];
  note: string;
};

const emptyForm = (): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  odometer: "",
  category: "fuel",
  amount: "",
  liters: "",
  full_tank: true,
  tags: [],
  note: "",
});

function ExpensesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchVehicles = useServerFn(listVehicles);
  const fetchExpenses = useServerFn(listExpenses);
  const createFn = useServerFn(createExpense);
  const updateFn = useServerFn(updateExpense);
  const deleteFn = useServerFn(deleteExpense);
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
  const currency = vehicle?.currency ?? settings.currency;
  const moneySettings = { ...settings, currency };
  const expenses = (expensesQ.data ?? []) as ExpenseRow[];

  const stats = useMemo(() => {
    const by = totalsByCategory(expenses);
    return {
      total: totalLogged(expenses),
      by,
      cum: cumulativeSpend(expenses).map((p) => ({
        date: p.date,
        total: moneyMinorToMajor(p.total, currency),
      })),
    };
  }, [expenses, currency]);

  const consPointsByOdo = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of consumptionPoints(expenses)) m.set(p.odometer_km, p.l_per_100km);
    return m;
  }, [expenses]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const saveMut = useMutation({
    mutationFn: async (f: FormState) => {
      const amount_minor = moneyMajorToMinor(parseLocalNumber(f.amount), currency);
      const odometer_km = Math.round(parseLocalNumber(f.odometer));
      const liters = f.category === "fuel" && f.liters ? parseLocalNumber(f.liters) : null;
      const payload = {
        vehicle_id: vehicle!.id,
        date: f.date,
        odometer_km,
        category: f.category,
        amount_minor,
        currency,
        liters,
        full_tank: f.category === "fuel" ? f.full_tank : null,
        tags: f.category === "fuel" ? f.tags : [],
        note: f.note || null,
      };
      if (f.id) {
        return updateFn({ data: { id: f.id, ...payload } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", vehicle?.id] });
      setDialogOpen(false);
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", vehicle?.id] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  function openAdd() {
    setForm({
      ...emptyForm(),
      odometer: vehicle?.current_odometer_km ? String(vehicle.current_odometer_km) : "",
    });
    setDialogOpen(true);
  }

  // FAB / nav trigger to open add dialog
  useEffect(() => {
    function handler() {
      if (!vehicle) return;
      openAdd();
    }
    window.addEventListener("revtab:add-expense", handler);
    if (typeof window !== "undefined" && window.location.hash === "#add" && vehicle) {
      openAdd();
      history.replaceState(null, "", window.location.pathname);
    }
    return () => window.removeEventListener("revtab:add-expense", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id]);

  function openEdit(e: ExpenseRow) {
    setForm({
      id: e.id,
      date: e.date,
      odometer: String(e.odometer_km),
      category: e.category,
      amount: String(moneyMinorToMajor(e.amount_minor, currency)),
      liters: e.liters != null ? String(e.liters) : "",
      full_tank: !!e.full_tank,
      tags: e.tags ?? [],
      note: (e as any).note ?? "",
    });
    setDialogOpen(true);
  }

  function exportCsv() {
    const header = [
      "date",
      "odometer_km",
      "category",
      "amount",
      "currency",
      "liters",
      "full_tank",
      "tags",
      "note",
    ];
    const rows = expenses.map((e) => [
      e.date,
      e.odometer_km,
      e.category,
      moneyMinorToMajor(e.amount_minor, currency).toFixed(2),
      currency,
      e.liters ?? "",
      e.full_tank == null ? "" : e.full_tank ? "true" : "false",
      (e.tags ?? []).join("|"),
      (((e as any).note ?? "") as string).replace(/[\r\n]+/g, " "),
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((c) => {
            const s = String(c);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${vehicle?.name ?? "vehicle"}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (vehiclesQ.isLoading) return <p className="text-muted-foreground">Loading…</p>;

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold mb-2">{t.nav.expenses}</h1>
        <p className="text-muted-foreground mb-6">{t.empty.noVehicles}</p>
        <Button onClick={() => navigate({ to: "/onboarding" })}>
          <Plus className="size-4 mr-1" /> Add vehicle
        </Button>
      </div>
    );
  }

  const amountNum = parseLocalNumber(form.amount);
  const litersNum = parseLocalNumber(form.liters);
  const pricePerLiter =
    form.category === "fuel" && isFinite(amountNum) && isFinite(litersNum) && litersNum > 0
      ? amountNum / litersNum
      : null;

  const catLabels: Record<Category, string> = {
    fuel: CATEGORY_META.fuel.label,
    service: CATEGORY_META.service.label,
    admin: CATEGORY_META.admin.label,
    other: CATEGORY_META.other.label,
  };

  const donutData = CATEGORIES.map((c) => ({
    name: catLabels[c],
    cat: c,
    value: moneyMinorToMajor(stats.by[c] ?? 0, currency),
    minor: stats.by[c] ?? 0,
    color: CATEGORY_META[c].color,
  })).filter((d) => d.value > 0);
  const totalMajor = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">{t.nav.expenses}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-full" onClick={exportCsv} disabled={expenses.length === 0}>
            <Download className="size-4 mr-1" /> Export CSV
          </Button>
          <Button onClick={openAdd} className="rounded-full">
            <Plus className="size-4 mr-1" /> Add expense
          </Button>
        </div>
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

      {/* Breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="kpi-card">
          <div className="text-sm font-semibold mb-3">Breakdown by category</div>
          {donutData.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No expenses logged yet.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative size-40 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={75}
                      paddingAngle={2}
                      stroke="var(--color-card)"
                      strokeWidth={2}
                    >
                      {donutData.map((d) => (
                        <Cell key={d.cat} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                      }}
                      formatter={(v: any) =>
                        formatMoney(Math.round(Number(v) * 100), moneySettings)
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Total</div>
                    <div className="text-sm font-semibold num">
                      {formatMoney(stats.total, moneySettings)}
                    </div>
                  </div>
                </div>
              </div>
              <ul className="flex-1 w-full space-y-2 text-sm">
                {donutData.map((d) => {
                  const pct = totalMajor > 0 ? (d.value / totalMajor) * 100 : 0;
                  return (
                    <li key={d.cat} className="flex items-center gap-3">
                      <CategoryIcon category={d.cat} className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="text-muted-foreground tabular-nums text-xs w-10 text-right">
                        {pct.toFixed(0)}%
                      </span>
                      <span className="num tabular-nums w-20 text-right">
                        {formatMoney(d.minor, moneySettings)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="kpi-card">
          <div className="text-sm font-semibold mb-2">Spend over time</div>
          <div className="h-48">
            {stats.cum.length === 0 ? (
              <div className="h-full grid place-items-center text-muted-foreground text-sm">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={stats.cum}>
                  <defs>
                    <linearGradient id="exp1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                    }}
                  />
                  <Area type="monotone" dataKey="total" stroke="var(--color-primary)" fill="url(#exp1)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="kpi-card">
        {expensesQ.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">{t.empty.noExpenses}</p>
            <Button onClick={openAdd}>
              <Plus className="size-4 mr-1" /> Add expense
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {expenses.map((e) => {
              const cons = e.category === "fuel" ? consPointsByOdo.get(e.odometer_km) ?? null : null;
              return (
                <li key={e.id} className="py-3 flex items-center gap-3">
                  <div
                    className="size-9 shrink-0 rounded-full grid place-items-center"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${CATEGORY_META[e.category].color} 18%, var(--color-card))`,
                    }}
                  >
                    <CategoryIcon category={e.category} className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{catLabels[e.category]}</span>
                      <span className="text-xs text-muted-foreground">{e.date}</span>
                      <span className="text-xs text-muted-foreground">
                        · {formatDistance(e.odometer_km, settings)}
                      </span>
                      {e.category === "fuel" && e.liters != null && (
                        <span className="text-xs text-muted-foreground">
                          · {formatVolume(e.liters, settings)}
                          {cons != null ? ` · ${formatConsumption(cons, settings)}` : ""}
                        </span>
                      )}
                    </div>
                    {e.tags && e.tags.length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {e.tags.join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="whitespace-nowrap font-semibold num tabular-nums">
                    {formatMoney(e.amount_minor, moneySettings)}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(e)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Delete this expense?")) deleteMut.mutate(e.id);
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="odo">Odometer (km)</Label>
                <Input
                  id="odo"
                  inputMode="numeric"
                  value={form.odometer}
                  onChange={(e) => setForm({ ...form, odometer: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as Category })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fuel">Fuel</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="amt">Amount ({currencySymbolFor(currency)})</Label>
              <Input
                id="amt"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>

            {form.category === "fuel" && (
              <>
                <div>
                  <Label htmlFor="lt">Liters</Label>
                  <Input
                    id="lt"
                    inputMode="decimal"
                    value={form.liters}
                    onChange={(e) => setForm({ ...form, liters: e.target.value })}
                  />
                  {pricePerLiter != null && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {pricePerLiter.toFixed(2)} {currencySymbolFor(currency)}/l
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="ft">Full tank</Label>
                  <Switch
                    id="ft"
                    checked={form.full_tank}
                    onCheckedChange={(v) => setForm({ ...form, full_tank: v })}
                  />
                </div>
                <div>
                  <Label>Context tags</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {CONTEXT_TAGS.map((tag) => {
                      const on = form.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className="tag-chip"
                          data-on={on}
                          onClick={() =>
                            setForm({
                              ...form,
                              tags: on
                                ? form.tags.filter((x) => x !== tag)
                                : [...form.tags, tag],
                            })
                          }
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMut.mutate(form)}
              disabled={
                saveMut.isPending ||
                !form.date ||
                !form.odometer ||
                !form.amount ||
                (form.category === "fuel" && !form.liters)
              }
            >
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-xs text-muted-foreground">
        Looking for trends or projections?{" "}
        <Link to="/insights" className="underline">
          Open Insights
        </Link>
        .
      </div>
    </div>
  );
}
