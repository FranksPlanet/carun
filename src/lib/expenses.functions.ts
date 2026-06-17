import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateExpenseSchema = z.object({
  vehicle_id: z.string().uuid(),
  date: z.string(),
  odometer_km: z.number().int().min(0).max(2_000_000),
  category_id: z.string().uuid(),
  amount_minor: z.number().int().min(0),
  currency: z.string().default("CZK"),
  liters: z.number().min(0).max(1000).optional().nullable(),
  full_tank: z.boolean().optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  note: z.string().max(500).optional().nullable(),
  receipt_path: z.string().max(500).optional().nullable(),
});

// Flatten the joined category role onto each expense row so calc.ts can
// identify fuel expenses without needing a separate lookup.
function flatten(rows: any[]): any[] {
  return rows.map((r) => {
    const cat = r.categories;
    const { categories: _drop, ...rest } = r;
    return {
      ...rest,
      role: cat?.role ?? "other",
      category_name: cat?.name ?? null,
      category_color: cat?.color ?? null,
      category_icon: cat?.icon ?? null,
    };
  });
}

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vehicle_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("expenses")
      .select("*, categories ( id, name, color, icon, role )")
      .eq("vehicle_id", data.vehicle_id)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return flatten(out ?? []);
  });

async function assertOwnsVehicle(supabase: any, vehicleId: string) {
  const { data, error } = await supabase.from("vehicles").select("id").eq("id", vehicleId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Vehicle not found or not yours.");
}

async function assertOwnsCategory(supabase: any, categoryId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Category not found or not yours.");
}

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateExpenseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnsVehicle(context.supabase, data.vehicle_id);
    await assertOwnsCategory(context.supabase, data.category_id);
    const { data: out, error } = await context.supabase
      .from("expenses")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

const UpdateExpenseSchema = CreateExpenseSchema.partial().extend({ id: z.string().uuid() });

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateExpenseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    if (rest.vehicle_id) await assertOwnsVehicle(context.supabase, rest.vehicle_id);
    if (rest.category_id) await assertOwnsCategory(context.supabase, rest.category_id);
    const { data: out, error } = await context.supabase
      .from("expenses")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkSchema = z.object({
  rows: z.array(CreateExpenseSchema).min(1).max(1000),
});

export const bulkCreateExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkSchema.parse(d))
  .handler(async ({ data, context }) => {
    const uniqueVehicles = [...new Set(data.rows.map((r) => r.vehicle_id))];
    for (const vid of uniqueVehicles) await assertOwnsVehicle(context.supabase, vid);
    const uniqueCats = [...new Set(data.rows.map((r) => r.category_id))];
    for (const cid of uniqueCats) await assertOwnsCategory(context.supabase, cid);
    const payload = data.rows.map((r) => ({ ...r, user_id: context.userId }));
    const { data: out, error } = await context.supabase
      .from("expenses")
      .insert(payload)
      .select();
    if (error) throw new Error(error.message);
    return { inserted: out?.length ?? 0 };
  });
