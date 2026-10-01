export const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", exact: true, label: "Repositories" },
  { href: "/dashboard/verify", exact: false, label: "Threshold Demo" },
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

export function repoSetupHref(owner: string, repo: string, opts?: { edit?: boolean }): string {
  const href = `/dashboard/setup?repo=${encodeURIComponent(`${owner}/${repo}`)}`;
  return opts?.edit ? `${href}&edit=1` : href;
}

export function projectPageHref(owner: string, repo: string): string {
  return `/dashboard/repos/${owner}/${repo}`;
}

export function commitPageHref(owner: string, repo: string, sha: string): string {
  return `/dashboard/commits/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(sha)}`;
}

export function projectCommitsHref(installationId: string, repoFullName: string): string | null {
  const installation = installationId.trim();
  const repo = repoFullName.trim();
  if (!installation || !repo) return null;
  return `/dashboard/status/${installation}?repo=${encodeURIComponent(repo)}`;
}
