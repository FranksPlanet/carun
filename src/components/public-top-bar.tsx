import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function PublicTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          to="/"
          className="display text-foreground text-lg font-semibold tracking-tight hover:opacity-80"
          aria-label="RevTab home"
        >
          RevTab
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Link>
      </div>
    </header>
  );
}
