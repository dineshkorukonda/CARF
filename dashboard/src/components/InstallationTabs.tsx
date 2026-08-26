import Link from "next/link";

type Tab = "status" | "config" | "rules" | "analytics";

const TABS: Array<{ id: Tab; label: string; href: (id: string) => string }> = [
  { id: "status", label: "Status", href: (id) => `/dashboard/status/${id}` },
  { id: "config", label: "Configure", href: (id) => `/dashboard/config/${id}` },
  { id: "rules", label: "Rules", href: (id) => `/dashboard/config/${id}/rules` },
  { id: "analytics", label: "Analytics", href: (id) => `/dashboard/analytics/${id}` },
];

export function InstallationTabs({ installationId, active }: { installationId: string; active: Tab }) {
  return (
    <nav className="flex gap-1 border-b border-border">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href(installationId)}
          className={
            "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors -mb-px " +
            (tab.id === active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
