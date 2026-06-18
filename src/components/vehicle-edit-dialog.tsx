import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { updateVehicle, deleteVehicle } from "@/lib/vehicles.functions";
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
import { Trash2 } from "lucide-react";
import { moneyMinorToMajor, parseLocalNumber } from "@/lib/format";

type Props = {
  vehicle: {
    id: string;
    name: string;
    currency: string;
    estimated_resale_value_minor: number | null;
  };
  trigger: React.ReactNode;
};

export function VehicleEditDialog({ vehicle, trigger }: Props) {
  const update = useServerFn(updateVehicle);
  const del = useServerFn(deleteVehicle);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(vehicle.name);
  const initialResale =
    vehicle.estimated_resale_value_minor != null
      ? String(moneyMinorToMajor(vehicle.estimated_resale_value_minor, vehicle.currency))
      : "";
  const [resale, setResale] = useState(initialResale);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(vehicle.name);
      setResale(initialResale);
      setConfirmOpen(false);
      setConfirmText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle.id]);

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const trimmed = resale.trim();
      const minor = trimmed
        ? Math.max(0, Math.round(parseLocalNumber(trimmed) * 100))
        : null;
      await update({
        data: {
          id: vehicle.id,
          name: trimmedName,
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

  async function onDelete() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await del({ data: { id: vehicle.id } });
      await qc.invalidateQueries();
      toast.success("Car deleted");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit car</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="veh-name">Name</Label>
            <Input
              id="veh-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My car"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resale">Estimated resale / current value ({vehicle.currency})</Label>
            <Input
              id="resale"
              inputMode="decimal"
              value={resale}
              onChange={(e) => setResale(e.target.value)}
              placeholder="What you could sell it for today"
            />
            <p className="text-xs text-muted-foreground">
              Used for honest depreciation-based cost/km. Leave empty to skip the depreciation view.
            </p>
          </div>

          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
            <div className="flex items-center gap-2 text-destructive font-medium text-sm">
              <Trash2 className="size-4" aria-hidden /> Delete this car
            </div>
            <p className="text-xs text-muted-foreground">
              Permanently removes this car and all its expenses. This cannot be undone.
            </p>
            {!confirmOpen ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={saving || deleting}
              >
                Delete car…
              </Button>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="veh-confirm" className="text-xs">
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                </Label>
                <Input
                  id="veh-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={confirmText !== "DELETE" || deleting}
                    onClick={onDelete}
                  >
                    {deleting ? "Deleting…" : "Permanently delete"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConfirmOpen(false);
                      setConfirmText("");
                    }}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || deleting}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
