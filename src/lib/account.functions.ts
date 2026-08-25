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

    // 1) Delete app rows in ONE transaction via the database function
    //    public.delete_own_account_data(). This must NOT be refactored back
    //    into a loop of .delete() calls: each PostgREST call is its own
    //    transaction, so a failure part-way through (the last-fuel-category
    //    trigger used to guarantee one) irreversibly destroyed some tables
    //    while leaving the account alive and un-deletable. One transaction
    //    means all-or-nothing, and therefore safely retryable.
    //    The function takes no arguments and derives the owner from auth.uid()
    //    inside the database, so a caller can never target another user.
    const { error: rpcErr } = await supabase.rpc("delete_own_account_data");
    if (rpcErr) throw new Error(`Failed deleting account data: ${rpcErr.message}`);

    // 2) Remove the user's storage objects (each bucket keeps them under a
    //    folder named after the user id).
    for (const bucket of ["vehicle-photos", "receipts"] as const) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 });
        if (files && files.length > 0) {
          const paths = files.map((f) => `${userId}/${f.name}`);
          await supabaseAdmin.storage.from(bucket).remove(paths);
        }
      } catch {
        // best-effort; don't block account deletion on storage errors
      }
    }

    // 3) Delete the auth user (service role).
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true };
  });
