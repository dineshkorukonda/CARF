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

/**
 * PEM keys are multi-line; pasting one into a single-line env var UI (or JSON-encoding it
 * along the way) commonly turns its real newlines into the two-character sequence "\n",
 * which crypto's key parser rejects outright ("secretOrPrivateKey must be an asymmetric
 * key when using RS256" from jsonwebtoken -- that error is really just "this doesn't look
 * like a PEM key"). Turn literal "\n" back into real newlines; a no-op for a key that
 * already has real ones, since those don't contain the two-character sequence.
 */
function normalizePrivateKey(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

/**
 * `requireEnv` only rejects an empty value, so a typo'd port used to survive as
 * `Number("smtp.example.com")` -- NaN -- and surface much later as an unrelated socket
 * error from nodemailer. Fail here instead, naming the variable at fault.
 */
function requirePort(name: string): number {
  const raw = requireEnv(name);
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${name}: expected a port between 1 and 65535, got "${raw}"`);
  }
  return port;
}

export const env = {
  /** Public origin the dashboard is served from, used to build OAuth/App-install redirect URIs. */
  baseUrl: () => requireEnv("DASHBOARD_BASE_URL"),
  /** HMAC secret signing the session cookie. Rotating it invalidates every live session. */
  sessionSecret: () => requireEnv("SESSION_SECRET"),
  /** URL slug of the CARF GitHub App, e.g. "carf-rollback" -- used to build the install-flow link. */
  githubAppSlug: () => normalizeGithubAppSlug(requireEnv("GITHUB_APP_SLUG")),
  githubAppId: () => requireEnv("GITHUB_APP_ID"),
  githubAppPrivateKey: () => normalizePrivateKey(requireEnv("GITHUB_APP_PRIVATE_KEY")),
  /** Base URL of the core-api instance this dashboard reads status data from (issue #64). */
  coreApiBaseUrl: () => requireEnv("CORE_API_BASE_URL"),
  /** SMTP creds for outbound mail (currently: password-reset links only). */
  smtpHost: () => requireEnv("SMTP_HOST"),
  smtpPort: () => requirePort("SMTP_PORT"),
  smtpUser: () => requireEnv("SMTP_USER"),
  smtpPassword: () => requireEnv("SMTP_PASS"),
  /** "From" address on outbound mail -- doesn't have to match SMTP_USER (e.g. a shared
   *  mailbox auth'd by one address sending as another), so it's its own var. */
  smtpFrom: () => requireEnv("SMTP_FROM"),
};
