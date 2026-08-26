function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  /** Public origin the dashboard is served from, used to build OAuth/App-install redirect URIs. */
  baseUrl: () => requireEnv("DASHBOARD_BASE_URL"),
  /** HMAC secret signing the session cookie. Rotating it invalidates every live session. */
  sessionSecret: () => requireEnv("SESSION_SECRET"),
  githubOAuthClientId: () => requireEnv("GITHUB_OAUTH_CLIENT_ID"),
  githubOAuthClientSecret: () => requireEnv("GITHUB_OAUTH_CLIENT_SECRET"),
  /** URL slug of the CARF GitHub App, e.g. "carf-rollback" -- used to build the install-flow link. */
  githubAppSlug: () => requireEnv("GITHUB_APP_SLUG"),
  githubAppId: () => requireEnv("GITHUB_APP_ID"),
  githubAppPrivateKey: () => requireEnv("GITHUB_APP_PRIVATE_KEY"),
  /** Base URL of the core-api instance this dashboard reads status data from (issue #64). */
  coreApiBaseUrl: () => requireEnv("CORE_API_BASE_URL"),
};
