import { randomBytes } from "node:crypto";

export const OAUTH_STATE_COOKIE = "carf_oauth_state";
export const GITHUB_APP_INSTALL_STATE_COOKIE = "carf_install_state";

/**
 * Anti-CSRF nonce for both OAuth flows (login and GitHub App install): generated when the
 * flow starts, stashed in a short-lived httpOnly cookie, and compared against the `state`
 * query param GitHub echoes back on the callback. Doesn't need to be signed -- the cookie
 * itself is httpOnly/secure and scoped to this browser, so possession of a matching value
 * already proves the callback belongs to a redirect this server initiated.
 */
export function generateOAuthState(): string {
  return randomBytes(16).toString("hex");
}
