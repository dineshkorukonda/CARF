import jwt from "jsonwebtoken";
import type { FetchFn } from "./fetchTypes";

// GitHub caps App JWTs at 10 minutes; matches core-api's realJwtSigner.ts convention.
const APP_JWT_EXPIRES_IN = "10m";

/**
 * Signs a GitHub App JWT (RS256, `iss` = App ID) for app-level (not installation-level)
 * API calls -- here, looking up the account/repo-selection details of an installation
 * right after GitHub's install flow hands us its bare `installation_id`.
 */
export function signGithubAppJwt(appId: string, privateKey: string): string {
  return jwt.sign({}, privateKey, {
    algorithm: "RS256",
    issuer: appId,
    expiresIn: APP_JWT_EXPIRES_IN,
  });
}

export interface GithubInstallation {
  id: number;
  account: { login: string; type: string } | null;
  repository_selection: string;
}

/**
 * `GET /app/installations/{id}` -- app-level auth (the JWT itself, no installation access
 * token needed) since we're asking about the installation's own metadata, not touching any
 * of its repos yet.
 */
export async function fetchInstallation(
  installationId: string,
  appJwt: string,
  fetchFn: FetchFn = fetch
): Promise<GithubInstallation> {
  const response = await fetchFn(`https://api.github.com/app/installations/${installationId}`, {
    headers: { Authorization: `Bearer ${appJwt}`, Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub installation fetch failed (status ${response.status}): ${body}`);
  }
  return (await response.json()) as GithubInstallation;
}
