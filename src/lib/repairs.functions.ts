import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { representativeDateFromPrecision } from "@/lib/calc";

const Precision = z.enum(["exact", "month", "season", "year"]);
const Season = z.enum(["spring", "summer", "autumn", "winter"]);

const Schema = z.object({
  vehicle_id: z.string().uuid(),
  label: z.string().min(1).max(80),
  amount_minor: z.number().int().min(0),
  currency: z.string().default("CZK"),
  precision: Precision,
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12).optional().nullable(),
  season: Season.optional().nullable(),
  exact_date: z.string().optional().nullable(),
});

export const listRepairs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vehicle_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("past_repairs")
      .select("*")
      .eq("vehicle_id", data.vehicle_id)
      .order("representative_date", { ascending: false });
    if (error) throw new Error(error.message);
    return out ?? [];
  });

export const createRepair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const rep = representativeDateFromPrecision(
      data.precision,
      data.year,
      data.month,
      data.season,
      data.exact_date,
    );
    const { data: out, error } = await context.supabase
      .from("past_repairs")
      .insert({ ...data, representative_date: rep, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteRepair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("past_repairs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
