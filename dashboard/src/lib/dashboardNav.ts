export const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", exact: true, label: "Repositories" },
  { href: "/dashboard/verify", exact: false, label: "Verification Harness" },
  { href: "/dashboard/settings", exact: false, label: "Settings" },
] as const;

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

export function repoSetupHref(owner: string, repo: string): string {
  return `/dashboard/setup?repo=${encodeURIComponent(`${owner}/${repo}`)}`;
}

export function projectPageHref(owner: string, repo: string): string {
  return `/dashboard/repos/${owner}/${repo}`;
}

export function projectCommitsHref(installationId: string, repoFullName: string): string | null {
  const installation = installationId.trim();
  const repo = repoFullName.trim();
  if (!installation || !repo) return null;
  return `/dashboard/status/${installation}?repo=${encodeURIComponent(repo)}`;
}
