import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { updateVehicle } from "@/lib/vehicles.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { moneyMinorToMajor, parseLocalNumber } from "@/lib/format";

type Props = {
  vehicle: {
    id: string;
    currency: string;
    estimated_resale_value_minor: number | null;
  };
  trigger: React.ReactNode;
};

export function VehicleEditDialog({ vehicle, trigger }: Props) {
  const update = useServerFn(updateVehicle);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const initial =
    vehicle.estimated_resale_value_minor != null
      ? String(moneyMinorToMajor(vehicle.estimated_resale_value_minor, vehicle.currency))
      : "";
  const [resale, setResale] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const trimmed = resale.trim();
      const minor = trimmed
        ? Math.max(0, Math.round(parseLocalNumber(trimmed) * 100))
        : null;
      await update({
        data: {
          id: vehicle.id,
          estimated_resale_value_minor: minor,
        },
      });
      await qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Saved");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Estimated resale / current value</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="resale">Value today ({vehicle.currency})</Label>
          <Input
            id="resale"
            inputMode="decimal"
            value={resale}
            onChange={(e) => setResale(e.target.value)}
            placeholder="What you could sell it for today"
          />
          <p className="text-xs text-muted-foreground">
            Used for honest depreciation-based cost/km. Leave empty if you don't want a depreciation view.
            Later: auto-suggest by make/model/age.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
