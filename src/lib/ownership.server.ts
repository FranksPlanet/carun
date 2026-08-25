// Shared ownership guards. RLS already scopes these tables to the caller, so a
// miss here means the row is either absent or someone else's — both are errors.
export async function assertOwnsVehicle(supabase: any, vehicleId: string) {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Vehicle not found or not yours.");
}

export async function assertOwnsCategory(supabase: any, categoryId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Category not found or not yours.");
}
