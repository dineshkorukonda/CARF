import Link from "next/link";

export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#docs-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <header className="border-b border-border bg-background">
        <nav aria-label="Documentation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-mono text-sm font-bold">CARF</Link>
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">Docs</Link>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/docs/integrations" aria-current="page" className="font-medium">Integrations</Link>
            <Link href="/dashboard" className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:bg-primary/90">Open dashboard</Link>
          </div>
        </nav>
      </header>
      <main id="docs-content" tabIndex={-1}>{children}</main>
      <footer className="mx-auto max-w-7xl border-t border-border px-4 py-6 text-sm text-muted-foreground sm:px-6">
        Ready to connect your repository? <Link href="/dashboard/setup" className="font-medium text-foreground underline underline-offset-4">Start repository setup</Link>
      </footer>
    </div>
  );
}
