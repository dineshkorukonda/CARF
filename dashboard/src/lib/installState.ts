import { randomBytes } from "node:crypto";

export const GITHUB_APP_INSTALL_STATE_COOKIE = "carf_install_state";

/**
 * Anti-CSRF nonce for the GitHub App install flow: generated when install/start redirects
 * to GitHub, stashed in a short-lived httpOnly cookie, and compared against the `state`
 * query param GitHub echoes back on the install callback. Doesn't need to be signed -- the
 * cookie itself is httpOnly/secure and scoped to this browser, so possession of a matching
 * value already proves the callback belongs to a redirect this server initiated.
 */
export function generateInstallState(): string {
  return randomBytes(16).toString("hex");
}
