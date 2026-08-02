import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SIGNED_PHOTO_URL_KEY = "signed-photo-url";

/**
 * Resolves a storage path in the `vehicle-photos` bucket to a signed URL.
 * Cached by React Query keyed on the path, so revisiting a vehicle within the
 * signed-URL validity window returns instantly instead of re-fetching.
 * Returns null while loading, on error, or when there is no path — the caller
 * shows its placeholder in that case (deliberately blank-then-load, never
 * stale-then-swap).
 */
export function useSignedPhotoUrl(photoPath: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: [SIGNED_PHOTO_URL_KEY, photoPath ?? null],
    enabled: !!photoPath,
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .storage
        .from("vehicle-photos")
        .createSignedUrl(photoPath as string, 60 * 60);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });

  if (!photoPath) return null;
  return data ?? null;
}
