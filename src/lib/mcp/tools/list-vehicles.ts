import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_vehicles",
  title: "List vehicles",
  description: "List the signed-in user's vehicles with purchase, odometer and resale details. Results are capped at the 200 most recently added vehicles.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("vehicles")
      .select(
        "id, name, plate, fuel_type, currency, purchase_date, purchase_price_minor, purchase_odometer_km, current_odometer_km, estimated_resale_value_minor",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { vehicles: data ?? [] },
    };
  },
});
