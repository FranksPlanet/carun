import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwnsCategory } from "@/lib/ownership.server";

const RoleEnum = z.enum(["fuel", "routine", "repair", "admin", "other"]);

const CreateSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1).max(40),
  role: RoleEnum,
  // Unit of measure, meaningful only for role='fuel' ("l", "kWh", "kg", …).
  unit: z.string().min(1).max(12).optional().nullable(),

  sort_order: z.number().int().optional(),
  description: z.string().max(200).optional().nullable(),
});

const UpdateSchema = CreateSchema.partial().extend({ id: z.string().uuid() });

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("categories")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const updateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: out, error } = await context.supabase
      .from("categories")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

// Reassign every expense referencing `from_id` to `to_id` and then delete the
// source category. The DB-level FK is ON DELETE RESTRICT, so this two-step
// move is the only safe way to drop a category that has data.
export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reassign_to: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { count, error: countErr } = await supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("category_id", data.id);
    if (countErr) throw new Error(countErr.message);

    if ((count ?? 0) > 0) {
      if (!data.reassign_to) {
        throw new Error(
          "This category still has expenses. Reassign them to another category before deleting.",
        );
      }
      if (data.reassign_to === data.id) {
        throw new Error("Pick a different category to reassign to.");
      }
      await assertOwnsCategory(supabase, data.reassign_to);
      const { error: moveErr } = await supabase
        .from("expenses")
        .update({ category_id: data.reassign_to })
        .eq("user_id", userId)
        .eq("category_id", data.id);
      if (moveErr) throw new Error(moveErr.message);
    }

    const { error } = await supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        items: z
          .array(z.object({ id: z.string().uuid(), sort_order: z.number().int() }))
          .min(1)
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Per-row update under RLS — keeps things simple and safe.
    for (const it of data.items) {
      const { error } = await context.supabase
        .from("categories")
        .update({ sort_order: it.sort_order })
        .eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
