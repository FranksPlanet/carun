import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateVehicle } from "@/lib/vehicles.functions";
import { Car, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function VehiclePhoto({
  vehicleId,
  photoPath,
  vehicleName,
}: {
  vehicleId: string;
  photoPath: string | null | undefined;
  vehicleName: string;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateVehicle);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      updateFn({ data: { id: vehicleId, photo_path: newPath } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${uid}/${vehicleId}-${Date.now()}.${ext}`;
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
    <div
      className="relative overflow-hidden rounded-2xl border border-border"
      style={{
        aspectRatio: "16 / 9",
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 14%, var(--color-card)), var(--color-card))",
      }}
    >
      {signedUrl ? (
        <img
          src={signedUrl}
          alt={vehicleName}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Car className="size-16 opacity-50" style={{ color: "var(--color-primary)" }} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2 flex gap-2 justify-end bg-gradient-to-t from-black/40 to-transparent">
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
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="size-4 mr-1" />
          {uploading ? "Uploading…" : signedUrl ? "Replace" : "Add photo"}
        </Button>
        {signedUrl && (
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full"
            onClick={removePhoto}
            aria-label="Remove photo"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
