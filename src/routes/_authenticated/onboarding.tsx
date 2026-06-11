import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { createVehicle } from "@/lib/vehicles.functions";
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
import { t } from "@/lib/strings";

const FUEL_TYPES = ["diesel", "petrol", "lpg", "hybrid", "electric"] as const;
type FuelType = (typeof FUEL_TYPES)[number];

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Add vehicle — RunningCost" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createVehicle);

  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [fuelType, setFuelType] = useState<FuelType>("petrol");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [purchaseOdo, setPurchaseOdo] = useState("0");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [currency, setCurrency] = useState("CZK");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await create({
        data: {
          name: name.trim(),
          plate: plate.trim() || null,
          fuel_type: fuelType,
          purchase_date: purchaseDate,
          purchase_odometer_km: Math.max(0, parseInt(purchaseOdo || "0", 10) || 0),
          purchase_price_minor: Math.max(
            0,
            Math.round((parseFloat(purchasePrice || "0") || 0) * 100),
          ),
          currency: currency.trim() || "CZK",
        },
      });
      await qc.invalidateQueries({ queryKey: ["vehicles"] });
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setError(err?.message ?? "Could not save vehicle");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl">{t.onboarding.basicsTitle}</h1>
        <p className="text-muted-foreground text-sm">{t.onboarding.framing}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Vehicle name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily Octavia" autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plate">License plate (optional)</Label>
          <Input id="plate" value={plate} onChange={(e) => setPlate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Fuel type</Label>
          <Select value={fuelType} onValueChange={(v) => setFuelType(v as FuelType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FUEL_TYPES.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="date">Purchase date</Label>
            <Input id="date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="odo">Odometer at purchase (km)</Label>
            <Input id="odo" type="number" min={0} value={purchaseOdo} onChange={(e) => setPurchaseOdo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Purchase price</Label>
            <Input id="price" type="number" min={0} step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "Saving…" : t.onboarding.finish}
        </Button>
      </form>
    </div>
  );
}
