export const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", exact: true, label: "Repositories" },
  { href: "/dashboard/integrations", exact: false, label: "Integrations" },
  { href: "/dashboard/settings", exact: false, label: "Settings" },
] as const;

export const DASHBOARD_NAV_GROUPS = [
  {
    id: "workspace",
    label: "Workspace",
    items: [DASHBOARD_NAV_ITEMS[0]],
  },
  {
    id: "connections",
    label: "Connections",
    items: [DASHBOARD_NAV_ITEMS[1]],
  },
  {
    id: "configuration",
    label: "Account",
    items: [DASHBOARD_NAV_ITEMS[2]],
  },
] as const;

/** Internal / research route. Not part of the product sidebar. */
export const THRESHOLD_DEMO_HREF = "/dashboard/verify";

export const INSTALLATION_SECTION_ITEMS = [
  { id: "status", label: "Live Status" },
  { id: "analytics", label: "Rollout Analytics" },
  { id: "integrations", label: "Integrations" },
] as const;

export type InstallationSectionId = (typeof INSTALLATION_SECTION_ITEMS)[number]["id"];

const SECTION_PATH: Record<InstallationSectionId, string> = {
  status: "status",
  analytics: "analytics",
  integrations: "integrations",
};

export function installationSectionHref(id: InstallationSectionId, installationId: string): string {
  return `/dashboard/${SECTION_PATH[id]}/${installationId}`;
}

export function projectThresholdsHref(installationId: string, repoFullName: string): string | null {
  const installation = installationId.trim();
  const repo = repoFullName.trim();
  if (!installation || !repo) return null;
  return `/dashboard/config/${installation}/rules?repo=${encodeURIComponent(repo)}`;
}

export function repoSetupHref(owner: string, repo: string, opts?: { edit?: boolean }): string {
  const href = `/dashboard/setup?repo=${encodeURIComponent(`${owner}/${repo}`)}`;
  return opts?.edit ? `${href}&edit=1` : href;
}

export const PROJECT_SECTIONS = [
  "overview",
  "commits",
  "rollouts",
  "activity",
  "settings",
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number];

export function projectPageHref(owner: string, repo: string): string {
  return `/dashboard/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function projectSectionHref(owner: string, repo: string, section: ProjectSection): string {
  const base = projectPageHref(owner, repo);
  return section === "overview" ? base : `${base}?view=${section}`;
}

export function projectCommitsHref(owner: string, repo: string): string {
  return projectSectionHref(owner, repo, "commits");
}

export function commitPageHref(owner: string, repo: string, sha: string): string {
  return `/dashboard/commits/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(sha)}`;
}
