import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FuelType = z.enum(["diesel", "petrol", "lpg", "hybrid", "electric"]);

const CreateVehicleSchema = z.object({
  name: z.string().min(1).max(60),
  plate: z.string().max(20).optional().nullable(),
  fuel_type: FuelType,
  purchase_date: z.string(),
  purchase_odometer_km: z.number().int().min(0).max(2_000_000),
  purchase_price_minor: z.number().int().min(0),
  currency: z.string().min(1).max(8).default("CZK"),
  current_odometer_km: z.number().int().min(0).max(2_000_000).default(0),
});

export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateVehicleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("vehicles")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

const UpdateVehicleSchema = CreateVehicleSchema.partial().extend({
  id: z.string().uuid(),
});

export const updateVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateVehicleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: out, error } = await context.supabase
      .from("vehicles")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
