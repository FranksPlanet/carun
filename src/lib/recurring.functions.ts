import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Type = z.enum(["insurance", "road_tax", "inspection", "parking", "other"]);

const Schema = z.object({
  vehicle_id: z.string().uuid(),
  type: Type,
  label: z.string().max(60).optional().nullable(),
  amount_minor_per_year: z.number().int().min(0),
  currency: z.string().default("CZK"),
});

export const listRecurring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vehicle_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("recurring_costs")
      .select("*")
      .eq("vehicle_id", data.vehicle_id);
    if (error) throw new Error(error.message);
    return out ?? [];
  });

export const createRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("recurring_costs")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recurring_costs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
