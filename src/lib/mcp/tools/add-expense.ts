import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_expense",
  title: "Add an expense",
  description:
    "Record an expense for one of the signed-in user's vehicles. Amount is in minor units (e.g. 45000 = 450,00 Kč). Use list_vehicles and list_categories first.",
  inputSchema: {
    vehicle_id: z.string().uuid().describe("Vehicle id from list_vehicles."),
    category_id: z.string().uuid().describe("Category id from list_categories."),
    date: z.string().describe("Date of the expense, ISO format YYYY-MM-DD."),
    odometer_km: z.number().int().describe("Odometer reading in km at the time of the expense."),
    amount_minor: z.number().int().describe("Amount in minor currency units."),
    currency: z.string().describe("Currency code, defaults to the vehicle's currency (CZK).").optional(),
    quantity: z.number().describe("Litres filled, for fuel expenses only.").optional(),
    full_tank: z.boolean().describe("Whether the tank was filled completely (fuel only).").optional(),
    note: z.string().describe("Short free-text note.").optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);

    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .select("id, currency")
      .eq("id", input.vehicle_id)
      .maybeSingle();
    if (vErr) return { content: [{ type: "text", text: vErr.message }], isError: true };
    if (!vehicle)
      return { content: [{ type: "text", text: "Vehicle not found." }], isError: true };

    const { data: category, error: cErr } = await supabase
      .from("categories")
      .select("id")
      .eq("id", input.category_id)
      .maybeSingle();
    if (cErr) return { content: [{ type: "text", text: cErr.message }], isError: true };
    if (!category)
      return { content: [{ type: "text", text: "Category not found." }], isError: true };

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: ctx.getUserId(),
        vehicle_id: input.vehicle_id,
        category_id: input.category_id,
        date: input.date,
        odometer_km: input.odometer_km,
        amount_minor: input.amount_minor,
        currency: input.currency ?? vehicle.currency ?? "CZK",
        quantity: input.quantity ?? null,
        full_tank: input.full_tank ?? null,
        note: input.note ?? null,
        tags: [],
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { expense: data },
    };
  },
});
