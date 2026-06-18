import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicTopBar } from "@/components/public-top-bar";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — RevTab" },
      { name: "description", content: "RevTab terms of service." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Placeholder — the legal content for these terms still needs to be filled in before launch.
          </p>
        </header>

        <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">To be completed before launch:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Acceptable use and account responsibilities</li>
            <li>Subscription terms (if any)</li>
            <li>Disclaimers and limitation of liability</li>
            <li>Governing law and jurisdiction</li>
            <li>Contact details for legal notices</li>
          </ul>
        </section>

        <nav className="flex flex-wrap gap-3 text-sm">
          <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">Privacy</Link>
          <Link to="/contact" className="text-primary underline-offset-4 hover:underline">Contact</Link>
          <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
        </nav>
      </div>
    </div>
  );
}
