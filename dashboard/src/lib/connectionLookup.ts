export function splitRepoFullName(fullName: string): { owner: string; repo: string } | null {
  const trimmed = fullName.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) return null;
  return { owner: trimmed.slice(0, slash), repo: trimmed.slice(slash + 1) };
}

export function findRepoConnection<T extends { owner: string; repo: string }>(
  connections: T[],
  fullName: string,
): T | undefined {
  const parts = splitRepoFullName(fullName);
  if (!parts) return undefined;
  return connections.find(
    (c) =>
      c.owner.toLowerCase() === parts.owner.toLowerCase() &&
      c.repo.toLowerCase() === parts.repo.toLowerCase(),
  );
}

export interface StoredPm2Setup {
  layout?: "git" | "releases";
  cwd?: string;
  healthUrl?: string;
  targetName?: string;
  releasesDir?: string;
  currentSymlink?: string;
}

/** Accepts verify's `target` blob or the adapter object written by /api/repo/link. */
export function pm2FieldsFromStoredConfig(stored: unknown): StoredPm2Setup {
  if (!stored || typeof stored !== "object") return {};
  const o = stored as Record<string, unknown>;
  const layout = o.layout === "git" || o.layout === "releases" ? o.layout : undefined;
  const cwd = typeof o.cwd === "string" ? o.cwd : undefined;
  const healthUrl = typeof o.healthUrl === "string" ? o.healthUrl : undefined;
  const targetName =
    typeof o.name === "string"
      ? o.name
      : typeof o.target === "string"
        ? o.target
        : undefined;
  const releasesDir =
    typeof o.releasesDir === "string"
      ? o.releasesDir
      : typeof o.releasesRoot === "string"
        ? o.releasesRoot
        : undefined;
  const currentSymlink = typeof o.currentSymlink === "string" ? o.currentSymlink : undefined;
  return { layout, cwd, healthUrl, targetName, releasesDir, currentSymlink };
}

export function isCarfHostProcess(name: string): boolean {
  return /^carf[-_]/i.test(name.trim());
}

/**
 * Never default Sahaay (or any product repo) onto carf-dashboard / carf-core-api.
 * Those are the host CARF processes, not the target under test.
 */
export function pickPm2App<T extends { name: string; cwd?: string }>(
  apps: T[],
  opts: { repoName: string; storedName?: string },
): T | undefined {
  if (apps.length === 0) return undefined;
  const byName = (n: string) => apps.find((a) => a.name.toLowerCase() === n.toLowerCase());
  const stored = opts.storedName?.trim();
  if (stored && !isCarfHostProcess(stored)) {
    const match = byName(stored);
    if (match) return match;
  }
  const repoMatch = opts.repoName.trim() ? byName(opts.repoName.trim()) : undefined;
  if (repoMatch) return repoMatch;
  return apps.find((a) => !isCarfHostProcess(a.name)) ?? apps[0];
}
