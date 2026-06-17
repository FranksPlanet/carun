import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Returns a JSON-serialisable bundle of all data owned by the signed-in user.
// RLS scopes every query — no admin client needed for export.
export const exportAllData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [vehicles, expenses, repairs, recurring, reminders, profile, categories] = await Promise.all([
      supabase.from("vehicles").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("past_repairs").select("*"),
      supabase.from("recurring_costs").select("*"),
      supabase.from("reminders").select("*"),
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("categories").select("*"),
    ]);
    const firstError =
      vehicles.error || expenses.error || repairs.error || recurring.error || reminders.error || profile.error || categories.error;
    if (firstError) throw new Error(firstError.message);
    return {
      exported_at: new Date().toISOString(),
      user_id: userId,
      profile: profile.data ?? null,
      vehicles: vehicles.data ?? [],
      categories: categories.data ?? [],
      expenses: expenses.data ?? [],
      past_repairs: repairs.data ?? [],
      recurring_costs: recurring.data ?? [],
      reminders: reminders.data ?? [],
    };
  });

// Hard-delete everything for the signed-in user. Uses the admin client to
// remove storage objects and finally the auth user, but only ever for
// context.userId — never an id supplied by the caller.
export const deleteAccountAndAllData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Delete app rows under the user's RLS-scoped client.
    const tables = ["expenses", "past_repairs", "recurring_costs", "reminders", "categories", "vehicles", "profiles"] as const;
    for (const tbl of tables) {
      const { error } = await supabase.from(tbl).delete().eq("user_id", userId);
      if (error) throw new Error(`Failed deleting ${tbl}: ${error.message}`);
    }

    // 2) Remove vehicle photos (stored under a folder named after the user id).
    try {
      const { data: files } = await supabaseAdmin.storage.from("vehicle-photos").list(userId, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await supabaseAdmin.storage.from("vehicle-photos").remove(paths);
      }
    } catch {
      // best-effort; don't block account deletion on storage errors
    }

    // 3) Delete the auth user (service role).
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });
