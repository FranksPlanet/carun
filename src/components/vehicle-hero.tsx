import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateVehicle, deleteVehicle } from "@/lib/vehicles.functions";
import { Car, Wrench, Camera, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moneyMinorToMajor, parseLocalNumber } from "@/lib/format";

type VehicleLike = {
  id: string;
  name: string;
  currency: string;
  photo_path: string | null | undefined;
  estimated_resale_value_minor: number | null;
};

export function VehicleHero({ vehicle, flush = false }: { vehicle: VehicleLike; flush?: boolean }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateVehicle);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoPath = vehicle.photo_path ?? null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!photoPath) { setSignedUrl(null); return; }
      const { data, error } = await supabase
        .storage
        .from("vehicle-photos")
        .createSignedUrl(photoPath, 60 * 60);
      if (!cancelled) {
        if (error) setSignedUrl(null);
        else setSignedUrl(data?.signedUrl ?? null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [photoPath]);

  const saveMut = useMutation({
    mutationFn: async (newPath: string | null) =>
      updateFn({ data: { id: vehicle.id, photo_path: newPath } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${uid}/${vehicle.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase
        .storage
        .from("vehicle-photos")
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;
      if (photoPath) {
        await supabase.storage.from("vehicle-photos").remove([photoPath]).catch(() => {});
      }
      await saveMut.mutateAsync(path);
      toast.success("Photo saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    if (!photoPath) return;
    if (!confirm("Remove this photo?")) return;
    try {
      await supabase.storage.from("vehicle-photos").remove([photoPath]).catch(() => {});
      await saveMut.mutateAsync(null);
      setSignedUrl(null);
      toast.success("Photo removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove");
    }
  }

  return (
    <>
      <div
        className={`relative overflow-hidden animate-fade-in ${
          flush ? "" : "rounded-sm border border-border"
        }`}
        style={{
          aspectRatio: "16 / 9",
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--color-secondary) 80%, var(--color-card)), var(--color-card))",
        }}
      >
        {signedUrl ? (
          <img
            src={signedUrl}
            alt={vehicle.name}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <Car className="size-20 opacity-50" style={{ color: "var(--color-primary)" }} />
          </div>
        )}

        {/* Readable scrim behind the name */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 via-black/25 to-transparent pointer-events-none" />

        {/* Name overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <h1 className="display text-white text-3xl sm:text-4xl leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
            {vehicle.name}
          </h1>
        </div>

        {/* Single wrench menu */}
        <div className="absolute top-2 right-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Vehicle options"
                className="rounded-full bg-black/45 backdrop-blur-sm p-2 text-white hover:bg-black/60 transition-colors"
                disabled={uploading}
              >
                <Wrench className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                <Camera className="size-4 mr-2" />
                {signedUrl ? "Replace photo" : "Add photo"}
              </DropdownMenuItem>
              {signedUrl && (
                <DropdownMenuItem onClick={removePhoto}>
                  <Trash2 className="size-4 mr-2" /> Remove photo
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="size-4 mr-2" /> Edit vehicle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Hidden trigger — controlled programmatically */}
      <ResaleDialog open={editOpen} onOpenChange={setEditOpen} vehicle={vehicle} />
    </>
  );
}

function ResaleDialog({
  open,
  onOpenChange,
  vehicle,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  vehicle: VehicleLike;
}) {
  const update = useServerFn(updateVehicle);
  const del = useServerFn(deleteVehicle);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const initial =
    vehicle.estimated_resale_value_minor != null
      ? String(moneyMinorToMajor(vehicle.estimated_resale_value_minor, vehicle.currency))
      : "";
  const [name, setName] = useState(vehicle.name);
  const [resale, setResale] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(vehicle.name);
      setResale(initial);
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
      onOpenChange(false);
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
      onOpenChange(false);
      navigate({ to: "/garage" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit car</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="veh-hero-name">Name</Label>
            <Input
              id="veh-hero-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My car"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resale-hero">Estimated resale / current value ({vehicle.currency})</Label>
            <Input
              id="resale-hero"
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
                <Label htmlFor="veh-hero-confirm" className="text-xs">
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                </Label>
                <Input
                  id="veh-hero-confirm"
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
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || deleting}>Cancel</Button>
          <Button onClick={save} disabled={saving || deleting}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
