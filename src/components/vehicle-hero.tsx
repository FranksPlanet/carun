import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateVehicle } from "@/lib/vehicles.functions";
import { Car, Wrench, Camera, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VehicleEditDialog } from "@/components/vehicle-edit-dialog";

type VehicleLike = {
  id: string;
  name: string;
  currency: string;
  photo_path: string | null | undefined;
  estimated_resale_value_minor: number | null;
};

export function VehicleHero({ vehicle }: { vehicle: VehicleLike }) {
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
        className="relative overflow-hidden rounded-2xl border border-border animate-fade-in"
        style={{
          aspectRatio: "16 / 9",
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--color-sand) 80%, var(--color-card)), var(--color-card))",
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
          <h1 className="display text-white text-2xl sm:text-3xl font-semibold leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
            {vehicle.name}
          </h1>
        </div>

        {/* Single wrench menu */}
        <div className="absolute top-2 right-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
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
      <VehicleEditDialogController
        open={editOpen}
        onOpenChange={setEditOpen}
        vehicle={vehicle}
      />
    </>
  );
}

// Small wrapper so we can open VehicleEditDialog from the dropdown without
// asking the caller to render a separate trigger.
function VehicleEditDialogController({
  open,
  onOpenChange,
  vehicle,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  vehicle: VehicleLike;
}) {
  // VehicleEditDialog manages its own open state via its trigger. We render an
  // invisible trigger and click it imperatively when `open` flips to true.
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) triggerRef.current?.click();
  }, [open]);
  return (
    <div className="hidden">
      <VehicleEditDialog
        vehicle={{
          id: vehicle.id,
          currency: vehicle.currency,
          estimated_resale_value_minor: vehicle.estimated_resale_value_minor,
        }}
        trigger={
          <button
            ref={triggerRef}
            type="button"
            aria-hidden
            onClick={() => onOpenChange(false)}
          />
        }
      />
    </div>
  );
}
