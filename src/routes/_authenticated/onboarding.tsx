import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { createVehicle } from "@/lib/vehicles.functions";
import { createRepair } from "@/lib/repairs.functions";
import { createRecurring } from "@/lib/recurring.functions";
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
import { Plus, Trash2 } from "lucide-react";
import { t } from "@/lib/strings";

const FUEL_TYPES = ["diesel", "petrol", "lpg", "hybrid", "electric"] as const;
type FuelType = (typeof FUEL_TYPES)[number];

const RECURRING_TYPES = ["insurance", "road_tax", "inspection", "parking", "other"] as const;
type RecurringType = (typeof RECURRING_TYPES)[number];

const PRECISIONS = ["exact", "month", "season", "year"] as const;
type Precision = (typeof PRECISIONS)[number];

const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
type Season = (typeof SEASONS)[number];

type RepairDraft = {
  label: string;
  amount: string;
  precision: Precision;
  exactDate: string;
  month: number;
  season: Season;
  year: number;
};

type RecurringDraft = {
  type: RecurringType;
  amount: string;
};

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Add vehicle — RunningCost" }] }),
  component: OnboardingPage,
});

function newRepair(): RepairDraft {
  const now = new Date();
  return {
    label: "",
    amount: "",
    precision: "year",
    exactDate: now.toISOString().slice(0, 10),
    month: now.getMonth() + 1,
    season: "spring",
    year: now.getFullYear(),
  };
}

function newRecurring(): RecurringDraft {
  return { type: "insurance", amount: "" };
}

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createV = useServerFn(createVehicle);
  const createR = useServerFn(createRepair);
  const createRC = useServerFn(createRecurring);

  const [step, setStep] = useState(1);
  const TOTAL = 5;

  // Step 1
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [fuelType, setFuelType] = useState<FuelType>("petrol");
  const [currentOdo, setCurrentOdo] = useState("0");

  // Step 2
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchaseOdo, setPurchaseOdo] = useState("0");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [currency, setCurrency] = useState("CZK");

  // Step 3
  const [repairs, setRepairs] = useState<RepairDraft[]>([]);

  // Step 4
  const [recurring, setRecurring] = useState<RecurringDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function canNext(): boolean {
    if (step === 1) return name.trim().length > 0;
    return true;
  }

  function next() {
    setError(null);
    if (step < TOTAL) setStep(step + 1);
  }
  function back() {
    setError(null);
    if (step > 1) setStep(step - 1);
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      const vehicle = await createV({
        data: {
          name: name.trim(),
          plate: plate.trim() || null,
          fuel_type: fuelType,
          purchase_date: purchaseDate,
          purchase_odometer_km: toInt(purchaseOdo),
          purchase_price_minor: toMinor(purchasePrice),
          currency: currency.trim() || "CZK",
          current_odometer_km: toInt(currentOdo),
        },
      });

      for (const r of repairs) {
        if (!r.label.trim()) continue;
        await createR({
          data: {
            vehicle_id: vehicle.id,
            label: r.label.trim(),
            amount_minor: toMinor(r.amount),
            currency,
            precision: r.precision,
            year: r.year,
            month: r.precision === "month" ? r.month : null,
            season: r.precision === "season" ? r.season : null,
            exact_date: r.precision === "exact" ? r.exactDate : null,
          },
        });
      }

      for (const c of recurring) {
        const amt = toMinor(c.amount);
        if (amt <= 0) continue;
        await createRC({
          data: {
            vehicle_id: vehicle.id,
            type: c.type,
            amount_minor_per_year: amt,
            currency,
          },
        });
      }

      await qc.invalidateQueries({ queryKey: ["vehicles"] });
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      setError(e?.message ?? "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest font-display">
          {t.onboarding.step(step, TOTAL)}
        </div>
        <h1 className="text-2xl font-semibold mt-1">{stepTitle(step)}</h1>
        <p className="text-muted-foreground text-sm mt-1">{stepHint(step)}</p>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Vehicle name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Daily Octavia" />
          </Field>
          <Field label="License plate (optional)">
            <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
          </Field>
          <Field label="Fuel type">
            <Select value={fuelType} onValueChange={(v) => setFuelType(v as FuelType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FUEL_TYPES.map((f) => <SelectItem key={f} value={f}>{cap(f)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Current odometer (km)">
            <Input type="number" min={0} value={currentOdo} onChange={(e) => setCurrentOdo(e.target.value)} />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase date">
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label="Odometer at purchase (km)">
            <Input type="number" min={0} value={purchaseOdo} onChange={(e) => setPurchaseOdo(e.target.value)} />
          </Field>
          <Field label="Purchase price">
            <Input type="number" min={0} step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </Field>
          <Field label="Currency">
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {repairs.map((r, i) => (
            <div key={i} className="kpi-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest font-display text-muted-foreground">
                  Repair {i + 1}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setRepairs(repairs.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Field label="Label">
                <Input value={r.label} onChange={(e) => updateRepair(setRepairs, repairs, i, { label: e.target.value })} placeholder="e.g. Timing belt" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount">
                  <Input type="number" min={0} step="0.01" value={r.amount}
                    onChange={(e) => updateRepair(setRepairs, repairs, i, { amount: e.target.value })} />
                </Field>
                <Field label="Date precision">
                  <Select value={r.precision} onValueChange={(v) => updateRepair(setRepairs, repairs, i, { precision: v as Precision })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact date</SelectItem>
                      <SelectItem value="month">Month + year</SelectItem>
                      <SelectItem value="season">Season + year</SelectItem>
                      <SelectItem value="year">Year only</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {r.precision === "exact" && (
                  <Field label="Date">
                    <Input type="date" value={r.exactDate}
                      onChange={(e) => updateRepair(setRepairs, repairs, i, { exactDate: e.target.value })} />
                  </Field>
                )}
                {r.precision === "month" && (
                  <Field label="Month">
                    <Select value={String(r.month)} onValueChange={(v) => updateRepair(setRepairs, repairs, i, { month: parseInt(v, 10) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, m) => (
                          <SelectItem key={m + 1} value={String(m + 1)}>
                            {new Date(2000, m, 1).toLocaleString(undefined, { month: "long" })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {r.precision === "season" && (
                  <Field label="Season">
                    <Select value={r.season} onValueChange={(v) => updateRepair(setRepairs, repairs, i, { season: v as Season })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEASONS.map((s) => <SelectItem key={s} value={s}>{cap(s)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {r.precision !== "exact" && (
                  <Field label="Year">
                    <Input type="number" min={1900} max={2100} value={r.year}
                      onChange={(e) => updateRepair(setRepairs, repairs, i, { year: parseInt(e.target.value || "0", 10) })} />
                  </Field>
                )}
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => setRepairs([...repairs, newRepair()])}>
            <Plus className="size-4 mr-1" /> Add repair
          </Button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          {recurring.map((c, i) => (
            <div key={i} className="kpi-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest font-display text-muted-foreground">
                  Cost {i + 1}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setRecurring(recurring.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <Select value={c.type} onValueChange={(v) => updateRecurring(setRecurring, recurring, i, { type: v as RecurringType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECURRING_TYPES.map((rt) => <SelectItem key={rt} value={rt}>{cap(rt.replace("_", " "))}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Amount / year">
                  <Input type="number" min={0} step="0.01" value={c.amount}
                    onChange={(e) => updateRecurring(setRecurring, recurring, i, { amount: e.target.value })} />
                </Field>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => setRecurring([...recurring, newRecurring()])}>
            <Plus className="size-4 mr-1" /> Add yearly cost
          </Button>
        </div>
      )}

      {step === 5 && (
        <div className="kpi-card space-y-2">
          <p className="text-muted-foreground">{t.onboarding.doneBody}</p>
          <ul className="text-sm space-y-1">
            <li>Vehicle: <span className="font-medium">{name || "—"}</span> ({cap(fuelType)})</li>
            <li>Current odometer: {currentOdo} km</li>
            <li>Purchased: {purchaseDate} at {purchaseOdo} km</li>
            <li>Remembered repairs: {repairs.filter((r) => r.label.trim()).length}</li>
            <li>Yearly costs: {recurring.filter((c) => toMinor(c.amount) > 0).length}</li>
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={back} disabled={step === 1 || submitting}>
          {t.onboarding.back}
        </Button>
        <div className="flex items-center gap-2">
          {(step === 3 || step === 4) && (
            <Button variant="ghost" onClick={next} disabled={submitting}>
              {t.onboarding.skip}
            </Button>
          )}
          {step < TOTAL ? (
            <Button onClick={next} disabled={!canNext() || submitting}>
              {t.onboarding.next}
            </Button>
          ) : (
            <Button onClick={finish} disabled={submitting || !name.trim()}>
              {submitting ? "Saving…" : t.onboarding.finish}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function stepTitle(step: number): string {
  return [t.onboarding.basicsTitle, t.onboarding.purchaseTitle, t.onboarding.repairsTitle, t.onboarding.recurringTitle, t.onboarding.doneTitle][step - 1];
}
function stepHint(step: number): string {
  if (step === 2) return t.onboarding.purchaseHint;
  if (step === 3) return t.onboarding.repairsHint;
  return t.onboarding.framing;
}

function updateRepair(
  setRepairs: (r: RepairDraft[]) => void,
  repairs: RepairDraft[],
  i: number,
  patch: Partial<RepairDraft>,
) {
  setRepairs(repairs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
}
function updateRecurring(
  setRecurring: (r: RecurringDraft[]) => void,
  recurring: RecurringDraft[],
  i: number,
  patch: Partial<RecurringDraft>,
) {
  setRecurring(recurring.map((r, j) => (j === i ? { ...r, ...patch } : r)));
}

function toInt(s: string): number {
  return Math.max(0, parseInt(s || "0", 10) || 0);
}
function toMinor(s: string): number {
  return Math.max(0, Math.round((parseFloat(s || "0") || 0) * 100));
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
