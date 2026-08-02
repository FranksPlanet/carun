import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_expenses",
  title: "List expenses",
  description:
    "List expenses for one of the signed-in user's vehicles, newest first. Amounts are in minor units (e.g. haléře for CZK).",
  inputSchema: {
    vehicle_id: z.string().uuid().describe("Vehicle id from list_vehicles."),
    limit: z.number().int().describe("How many rows to return (1-200, default 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ vehicle_id, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const take = Math.min(Math.max(limit ?? 50, 1), 200);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, date, odometer_km, amount_minor, currency, quantity, full_tank, note, tags, categories!expenses_category_id_fkey ( id, name, role )",
      )
      .eq("vehicle_id", vehicle_id)
      .order("date", { ascending: false })
      .limit(take);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { expenses: data ?? [] },
    };
  },
});
