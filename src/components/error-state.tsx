import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared, minimal failure state for data fetches that errored.
 * Deliberately plain — matches the "ink & acid" card language, no new tokens.
 */
export function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  retrying = false,
  compact = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`kpi-card text-center ${compact ? "py-6" : "py-10"} space-y-3`}
    >
      <AlertTriangle
        className="size-6 mx-auto text-muted-foreground"
        aria-hidden
      />
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground break-words">
          {message ?? "Something went wrong while fetching your data."}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      )}
    </div>
  );
}

/** Normalises an unknown query/mutation error into a short human message. */
export function errorMessage(error: unknown, fallback = "Please try again."): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again.";
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
