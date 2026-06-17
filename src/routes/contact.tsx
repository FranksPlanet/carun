import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — RevTab" },
      { name: "description", content: "Contact RevTab and find legal and business information." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight">Contact</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Placeholder — legal and business details below need to be filled in before launch.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-6 text-sm">
          <h2 className="font-display text-lg font-semibold">Business details</h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">Legal name</dt>
              <dd>[Company / sole trader name]</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Registered address</dt>
              <dd>[Street, city, postcode, country]</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Company / tax ID</dt>
              <dd>[IČO / VAT / equivalent]</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Email</dt>
              <dd>[hello@revtab.app]</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 text-sm">
          <h2 className="font-display text-lg font-semibold">Legal</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
                Terms of service
              </Link>
            </li>
          </ul>
        </section>

        <p className="text-xs text-muted-foreground">
          Note: this page is a placeholder. Replace bracketed fields with the real legal/business
          information before going live.
        </p>
      </div>
    </div>
  );
}
