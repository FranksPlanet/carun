import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ErrorState, errorMessage } from "@/components/error-state";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CategoryIcon,
  useCategories,
  categoryById,
  defaultForRole,
  findCategoryByName,
  type CategoryRow,
} from "@/lib/categories";
import { listVehicles } from "@/lib/vehicles.functions";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/lib/expenses.functions";
import { getProfile } from "@/lib/profile.functions";
import { applyVatView, vatSplit, vatTotals } from "@/lib/vat";
import {
  consumptionSeries,
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
  formatQuantity,
  formatConsumptionUnit,
  formatPricePerUnit,
  formatDate,
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
import { Plus, Pencil, Trash2, Download, Camera, Upload } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/strings";
import { scanReceipt } from "@/lib/ocr.functions";
import { ImportExpensesDialog } from "@/components/import-expenses-dialog";
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
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — RevTab" }] }),
  component: ExpensesPage,
});

type FormState = {
  id?: string;
  date: string;
  odometer: string;
  category_id: string;
  amount: string;
  quantity: string;
  full_tank: boolean;
  tags: string[];
  note: string;
  vat_rate: string;
};

const emptyForm = (categoryId: string): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  odometer: "",
  category_id: categoryId,
  amount: "",
  quantity: "",
  full_tank: true,
  tags: [],
  note: "",
  vat_rate: "21",
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
  const categoriesQ = useCategories();
  const categories: CategoryRow[] = categoriesQ.data ?? [];
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
  const exVat = Boolean((profileQ.data as any)?.show_prices_ex_vat);
  const rawExpenses = (expensesQ.data ?? []) as unknown as ExpenseRow[];
  const expenses = useMemo(
    () => applyVatView(rawExpenses as any[], exVat) as unknown as ExpenseRow[],
    [rawExpenses, exVat],
  );
  const rawById = useMemo(
    () => new Map(rawExpenses.map((e) => [e.id, e] as const)),
    [rawExpenses],
  );
  const vatSummary = useMemo(() => vatTotals(rawExpenses as any[]), [rawExpenses]);

  const fuelDefault = defaultForRole(categories, "fuel");
  const otherDefault = defaultForRole(categories, "other") ?? categories[0];


  const stats = useMemo(() => {
    const by: Record<string, number> = {};
    for (const e of expenses) by[e.category_id] = (by[e.category_id] ?? 0) + e.amount_minor;
    return {
      total: totalLogged(expenses),
      by,
      cum: cumulativeSpend(expenses).map((p) => ({
        date: p.date,
        total: moneyMinorToMajor(p.total, currency),
      })),
    };
  }, [expenses, currency]);

  // Cumulative spend stacked by category — keys are category ids so colours
  // and labels follow whatever the user has defined.
  const stackedCum = useMemo(() => {
    if (categories.length === 0) return [];
    const sorted = [...expenses].sort((a, b) =>
      a.date === b.date ? a.odometer_km - b.odometer_km : a.date < b.date ? -1 : 1,
    );
    const running: Record<string, number> = {};
    for (const c of categories) running[c.id] = 0;
    const byDate = new Map<string, any>();
    for (const e of sorted) {
      if (running[e.category_id] == null) running[e.category_id] = 0;
      running[e.category_id] += e.amount_minor;
      const row: any = { date: e.date };
      for (const c of categories) row[c.id] = moneyMinorToMajor(running[c.id] ?? 0, currency);
      byDate.set(e.date, row);
    }
    return Array.from(byDate.values());
  }, [expenses, currency, categories]);

  const consPointsByOdo = useMemo(() => {
    const m = new Map<number, { per100km: number; unit: string }>();
    for (const s of consumptionSeries(expenses, categories as any))
      for (const pt of s.points) m.set(pt.odometer_km, { per100km: pt.per_100km, unit: s.unit });
    return m;
  }, [expenses, categories]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(""));
  const [importOpen, setImportOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const scanFn = useServerFn(scanReceipt);

  const selectedCategory = categoryById(categories, form.category_id);
  const selectedIsFuel = selectedCategory?.role === "fuel";

  async function handleScan(file: File) {
    if (!vehicle) return;
    setScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const s = String(r.result || "");
          const i = s.indexOf(",");
          resolve(i >= 0 ? s.slice(i + 1) : s);
        };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const res = await scanFn({
        data: { image_base64: base64, mime_type: file.type || "image/jpeg" },
      });
      // Map OCR's free-text guess to one of the user's categories, never auto-create.
      const guess =
        (res.category && findCategoryByName(categories, res.category)) ||
        (res.liters != null ? fuelDefault : null) ||
        otherDefault;
      setForm({
        ...emptyForm(guess?.id ?? ""),
        odometer: vehicle.current_odometer_km ? String(vehicle.current_odometer_km) : "",
        date: res.date || new Date().toISOString().slice(0, 10),
        amount: res.total != null ? String(res.total) : "",
        quantity: res.liters != null ? String(res.liters) : "",
        note: res.station ?? "",
      });
      setDialogOpen(true);
      if (res.total == null && res.date == null) {
        toast.message("Couldn't read the receipt — please fill it in.");
      } else {
        toast.success("Receipt scanned — please review and save.");
      }
      if (res.currency && res.currency !== currency) {
        toast.warning(
          `This receipt looks like it's in ${res.currency}, but this vehicle is tracked in ${currency}. The amount was not converted — please check it.`,
        );
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't scan receipt");
      setForm({
        ...emptyForm(otherDefault?.id ?? ""),
        odometer: vehicle.current_odometer_km ? String(vehicle.current_odometer_km) : "",
      });
      setDialogOpen(true);
    } finally {
      setScanning(false);
    }
  }

  const saveMut = useMutation({
    mutationFn: async (f: FormState) => {
      const amount_minor = moneyMajorToMinor(parseLocalNumber(f.amount), currency);
      const odometer_km = Math.round(parseLocalNumber(f.odometer));
      const isFuel = categoryById(categories, f.category_id)?.role === "fuel";
      const quantity = isFuel && f.quantity ? parseLocalNumber(f.quantity) : null;
      const payload = {
        vehicle_id: vehicle!.id,
        date: f.date,
        odometer_km,
        category_id: f.category_id,
        amount_minor,
        currency,
        quantity,
        full_tank: isFuel ? f.full_tank : null,
        tags: isFuel ? f.tags : [],
        note: f.note || null,
        vat_rate:
          f.vat_rate.trim() === "" || !isFinite(parseLocalNumber(f.vat_rate))
            ? null
            : parseLocalNumber(f.vat_rate),
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
    onError: (e: any) => toast.error(errorMessage(e, "Failed to save")),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", vehicle?.id] });
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(errorMessage(e, "Failed to delete")),
  });

  function openAdd() {
    setForm({
      ...emptyForm(fuelDefault?.id ?? otherDefault?.id ?? ""),
      odometer: vehicle?.current_odometer_km ? String(vehicle.current_odometer_km) : "",
    });
    setDialogOpen(true);
  }

  // FAB / nav trigger to open add dialog
  useEffect(() => {
    function handler() {
      if (!vehicle || categories.length === 0) return;
      openAdd();
    }
    window.addEventListener("revtab:add-expense", handler);
    if (
      typeof window !== "undefined" &&
      window.location.hash === "#add" &&
      vehicle &&
      categories.length > 0
    ) {
      openAdd();
      history.replaceState(null, "", window.location.pathname);
    }
    return () => window.removeEventListener("revtab:add-expense", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.id, categories.length]);

  function openEdit(row: ExpenseRow) {
    // Always edit the raw (gross) row, never the VAT-transformed view.
    const e = (rawById.get(row.id) ?? row) as any;
    setForm({
      id: e.id,
      date: e.date,
      odometer: String(e.odometer_km),
      category_id: e.category_id,
      amount: String(moneyMinorToMajor(e.amount_minor, currency)),
      quantity: e.quantity != null ? String(e.quantity) : "",
      full_tank: !!e.full_tank,
      tags: e.tags ?? [],
      note: e.note ?? "",
      vat_rate: e.vat_rate != null ? String(Number(e.vat_rate)) : "",
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
      "quantity",
      "full_tank",
      "tags",
      "note",
    ];
    const rows = expenses.map((e) => [
      e.date,
      e.odometer_km,
      categoryById(categories, e.category_id)?.name ?? "",
      moneyMinorToMajor(e.amount_minor, currency).toFixed(2),
      currency,
      e.quantity ?? "",
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

  if (vehiclesQ.isError || categoriesQ.isError) {
    const q = vehiclesQ.isError ? vehiclesQ : categoriesQ;
    return (
      <ErrorState
        title="Couldn't load Expenses"
        message={errorMessage(q.error)}
        onRetry={() => q.refetch()}
        retrying={q.isFetching}
      />
    );
  }

  if (vehiclesQ.isLoading || categoriesQ.isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="h-32 kpi-card animate-pulse" />
      </div>
    );
  }

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
  const litersNum = parseLocalNumber(form.quantity);
  const pricePerLiter =
    selectedIsFuel && isFinite(amountNum) && isFinite(litersNum) && litersNum > 0
      ? amountNum / litersNum
      : null;

  const donutData = categories
    .map((c) => ({
      id: c.id,
      cat: c,
      name: c.name,
      value: moneyMinorToMajor(stats.by[c.id] ?? 0, currency),
      minor: stats.by[c.id] ?? 0,
      color: c.color,
    }))
    .filter((d) => d.value > 0);
  const totalMajor = donutData.reduce((s, d) => s + d.value, 0);
  const categoriesWithSpend = categories.filter((c) => (stats.by[c.id] ?? 0) > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">{t.nav.expenses}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={scanRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleScan(f);
              if (scanRef.current) scanRef.current.value = "";
            }}
          />
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => scanRef.current?.click()}
            disabled={scanning}
          >
            <Camera className="size-4 mr-1" /> {scanning ? "Scanning…" : "Scan receipt"}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => setImportOpen(true)}>
            <Upload className="size-4 mr-1" /> Import
          </Button>
          <Button variant="outline" className="rounded-full" onClick={exportCsv} disabled={expenses.length === 0}>
            <Download className="size-4 mr-1" /> Export CSV
          </Button>
          <Button onClick={openAdd} className="rounded-full hidden md:inline-flex">
            <Plus className="size-4 mr-1" /> Add expense
          </Button>
        </div>
      </div>

      {vehicle && (
        <ImportExpensesDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          vehicleId={vehicle.id}
          currency={currency}
        />
      )}


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

      {/* VAT summary */}
      {rawExpenses.length > 0 && (
        <div className="kpi-card">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="text-sm font-semibold">VAT</div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {exVat ? "Showing prices excl. VAT" : "Showing prices incl. VAT"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="text-muted-foreground">Paid </span>
              <span className="num tabular-nums font-semibold">
                {formatMoney(vatSummary.gross, moneySettings)}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">Net </span>
              <span className="num tabular-nums font-semibold">
                {formatMoney(vatSummary.net, moneySettings)}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">VAT </span>
              <span className="num tabular-nums font-semibold">
                {formatMoney(vatSummary.vat, moneySettings)}
              </span>
            </span>
          </div>
          {vatSummary.unknownCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {vatSummary.unknownCount} expense{vatSummary.unknownCount === 1 ? "" : "s"} (
              {formatMoney(vatSummary.unknownGross, moneySettings)}) have no VAT rate set, so the
              VAT total above is understated.
            </p>
          )}
        </div>
      )}


      {/* Breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <div id="category-breakdown" className="kpi-card">
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
                        <Cell key={d.id} fill={d.color} />
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
                    <li key={d.id} className="flex items-center gap-3">
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
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-sm font-semibold">Cumulative spend</div>
            <div className="text-xs text-muted-foreground num tabular-nums">
              {formatMoney(stats.total, moneySettings)}
            </div>
          </div>
          <div className="h-48">
            {stackedCum.length === 0 ? (
              <div className="h-full grid place-items-center text-muted-foreground text-sm">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={stackedCum} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {categories.map((c) => (
                      <linearGradient key={c.id} id={`exp-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.color} stopOpacity={0.85} />
                        <stop offset="100%" stopColor={c.color} stopOpacity={0.55} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    tickFormatter={(d: string) => {
                      const dt = new Date(d);
                      return isNaN(+dt)
                        ? d
                        : dt.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
                    }}
                    minTickGap={28}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-border)" }}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    width={40}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: any, name: any) => [
                      formatMoney(Math.round(Number(v) * 100), moneySettings),
                      categoryById(categories, name as string)?.name ?? name,
                    ]}
                  />
                  {categories.map((c) => (
                    <Area
                      key={c.id}
                      type="monotone"
                      dataKey={c.id}
                      stackId="1"
                      stroke={c.color}
                      strokeWidth={1}
                      fill={`url(#exp-${c.id})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {stackedCum.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              {categoriesWithSpend.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                  <CategoryIcon category={c} className="size-3.5" />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="num tabular-nums font-medium">
                    {formatMoney(stats.by[c.id] ?? 0, moneySettings)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* List */}
      <div className="kpi-card">
        {expensesQ.isError ? (
          <ErrorState
            compact
            title="Couldn't load expenses"
            message={errorMessage(expensesQ.error)}
            onRetry={() => expensesQ.refetch()}
            retrying={expensesQ.isFetching}
          />
        ) : expensesQ.isLoading ? (
          <ul className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <li key={i} className="py-3 flex items-center gap-3">
                <div className="size-9 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </li>
            ))}
          </ul>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">{t.empty.noExpenses}</p>
            <Button onClick={openAdd} className="rounded-full">
              <Plus className="size-4 mr-1" /> Add expense
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {expenses.map((e) => {
              const cat = categoryById(categories, e.category_id);
              const isFuel = cat?.role === "fuel";
              const cons = isFuel ? consPointsByOdo.get(e.odometer_km) ?? null : null;
              const fallbackColor = cat?.color ?? "var(--color-muted)";
              return (
                <li key={e.id} className="py-3 grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 gap-y-1">
                  <div
                    className="size-9 shrink-0 rounded-full grid place-items-center"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${fallbackColor} 18%, var(--color-card))`,
                    }}
                  >
                    <CategoryIcon category={cat ?? null} className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{cat?.name ?? "Uncategorised"}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(e.date, settings)}</span>
                      <span className="text-xs text-muted-foreground">
                        · {formatDistance(e.odometer_km, settings)}
                      </span>
                    </div>
                    {isFuel && e.quantity != null && (
                      <div className="text-xs text-muted-foreground">
                        {formatQuantity(e.quantity, cat?.unit ?? "l", settings)}
                        {cons != null
                          ? ` · ${formatConsumptionUnit(cons.per100km, cons.unit, settings)}`
                          : ""}
                      </div>
                    )}
                    {(e as any).note && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {(e as any).note}
                      </div>
                    )}
                    {e.tags && e.tags.length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {e.tags.join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="whitespace-nowrap font-semibold num tabular-nums text-right col-start-3 sm:col-start-auto">
                    {formatMoney(e.amount_minor, moneySettings)}
                  </div>
                  <div className="col-span-3 sm:col-span-1 flex justify-end gap-1 sm:contents">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(e)} aria-label="Edit expense">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this expense?")) deleteMut.mutate(e.id);
                      }}
                      aria-label="Delete expense"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
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
            {!form.id && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => scanRef.current?.click()}
                disabled={scanning}
              >
                <Camera className="size-4 mr-2" />
                {scanning ? "Scanning receipt…" : "Scan receipt"}
              </Button>
            )}
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
                value={form.category_id}
                onValueChange={(v) => setForm({ ...form, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <CategoryIcon category={c} className="size-4" />
                        <span>{c.name}</span>
                        {c.description && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            — {c.description}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory?.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedCategory.description}
                </p>
              )}
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

            <div>
              <Label htmlFor="vat">VAT rate (%)</Label>
              <Input
                id="vat"
                inputMode="decimal"
                placeholder="Leave empty if unknown"
                value={form.vat_rate}
                onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}
              />
              {(() => {
                const rateStr = form.vat_rate.trim();
                const rate = parseLocalNumber(rateStr);
                if (rateStr === "" || !isFinite(rate)) {
                  return (
                    <div className="text-xs text-muted-foreground mt-1">
                      VAT unknown — the amount counts as paid in full.
                    </div>
                  );
                }
                if (!isFinite(amountNum) || amountNum <= 0) return null;
                const s = vatSplit(moneyMajorToMinor(amountNum, currency), rate);
                return (
                  <div className="text-xs text-muted-foreground mt-1">
                    Net {formatMoney(s.net, moneySettings)} · VAT{" "}
                    {formatMoney(s.vat, moneySettings)}
                  </div>
                );
              })()}
            </div>



            {selectedIsFuel && (
              <>
                <div>
                  <Label htmlFor="lt">Quantity</Label>
                  <Input
                    id="lt"
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                  {pricePerLiter != null && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatPricePerUnit(
                        moneyMajorToMinor(pricePerLiter, currency),
                        selectedCategory?.unit ?? "l",
                        settings,
                      )}
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
          {(() => {
            const amt = parseLocalNumber(form.amount);
            const odo = parseLocalNumber(form.odometer);
            const lt = parseLocalNumber(form.quantity);
            const invalid =
              !form.date ||
              !form.category_id ||
              !(isFinite(odo) && odo >= 0) ||
              !(isFinite(amt) && amt > 0) ||
              (selectedIsFuel && !(isFinite(lt) && lt > 0));
            return (
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => saveMut.mutate(form)}
                  disabled={saveMut.isPending || scanning || invalid}
                >
                  {saveMut.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            );
          })()}
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
