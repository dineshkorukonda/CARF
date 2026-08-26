function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * GitHub's own App settings page and its "Public page" link both display the slug as part
 * of a full URL (e.g. "https://github.com/apps/carf-cp" or ".../installations/new?state=...")
 * -- easy to paste the whole thing instead of just the slug. Tolerate that by extracting
 * the path segment right after "/apps/" if the value looks like a URL at all.
 */
function normalizeGithubAppSlug(value: string): string {
  const match = value.match(/\/apps\/([^/?]+)/);
  return match ? match[1]! : value;
}

export const env = {
  /** Public origin the dashboard is served from, used to build OAuth/App-install redirect URIs. */
  baseUrl: () => requireEnv("DASHBOARD_BASE_URL"),
  /** HMAC secret signing the session cookie. Rotating it invalidates every live session. */
  sessionSecret: () => requireEnv("SESSION_SECRET"),
  /** URL slug of the CARF GitHub App, e.g. "carf-rollback" -- used to build the install-flow link. */
  githubAppSlug: () => normalizeGithubAppSlug(requireEnv("GITHUB_APP_SLUG")),
  githubAppId: () => requireEnv("GITHUB_APP_ID"),
  githubAppPrivateKey: () => requireEnv("GITHUB_APP_PRIVATE_KEY"),
  /** Base URL of the core-api instance this dashboard reads status data from (issue #64). */
  coreApiBaseUrl: () => requireEnv("CORE_API_BASE_URL"),
};
