import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      // Trigger should have created it, but be defensive
      const { data: created, error: e2 } = await context.supabase
        .from("profiles")
        .insert({ user_id: context.userId })
        .select()
        .single();
      if (e2) throw new Error(e2.message);
      return created;
    }
    return data;
  });

const UpdateProfileSchema = z.object({
  currency: z.string().min(1).max(8).optional(),
  distance_unit: z.enum(["km", "mi"]).optional(),
  volume_unit: z.enum(["l", "gal"]).optional(),
  consumption_style: z.enum(["l_per_100km", "km_per_l", "mpg"]).optional(),
  locale: z.string().min(1).max(8).optional(),
  default_cost_per_km_mode: z.enum(["operating", "with_depreciation", "with_full_purchase"]).optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: out, error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });
