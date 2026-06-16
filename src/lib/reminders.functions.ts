import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Type = z.enum(["service", "insurance", "inspection", "tyre_change", "other"]);

const Schema = z.object({
  vehicle_id: z.string().uuid(),
  type: Type,
  due_date: z.string().optional().nullable(),
  due_odometer_km: z.number().int().min(0).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
});

export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vehicle_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("reminders")
      .select("*")
      .eq("vehicle_id", data.vehicle_id);
    if (error) throw new Error(error.message);
    return out ?? [];
  });

export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: v, error: vErr } = await context.supabase
      .from("vehicles").select("id").eq("id", data.vehicle_id).maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!v) throw new Error("Vehicle not found or not yours.");
    const { data: out, error } = await context.supabase
      .from("reminders")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reminders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
