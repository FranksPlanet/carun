import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Card state persisted per device. Read after mount only, so SSR/first render
 * always matches the `defaultOpen` markup and never touches localStorage.
 */
function usePersistedOpen(storageKey: string, defaultOpen: boolean) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "0") setOpen(false);
      else if (raw === "1") setOpen(true);
    } catch {
      /* storage unavailable — keep the default */
    }
  }, [storageKey]);
  const set = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return [open, set] as const;
}

export function CollapsibleCard({
  id,
  title,
  aside,
  storageKey,
  defaultOpen = true,
  children,
}: {
  id?: string;
  title: ReactNode;
  /** Stays visible when collapsed — usually the headline total. */
  aside?: ReactNode;
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = usePersistedOpen(storageKey, defaultOpen);
  const bodyId = `${useId()}-body`;

  return (
    <div id={id} className="kpi-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="w-full min-h-11 flex items-center justify-between gap-3 text-left -mx-1 px-1 hover:bg-accent/15"
      >
        <span className="min-w-0 flex items-center gap-2">
          <ChevronDown
            aria-hidden
            className={`size-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="text-sm font-semibold truncate">{title}</span>
        </span>
        {aside != null && (
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground num tabular-nums">
            {aside}
          </span>
        )}
      </button>
      <div id={bodyId} hidden={!open} className={open ? "mt-2" : undefined}>
        {children}
      </div>
    </div>
  );
}
