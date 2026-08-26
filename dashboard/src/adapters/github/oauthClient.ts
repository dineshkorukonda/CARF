import type { FetchFn } from "./fetchTypes";

export interface GithubOAuthUser {
  id: number;
  login: string;
  avatar_url: string | null;
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Exchanges the OAuth `code` GitHub's authorize redirect handed back to `/api/auth/github/callback`
 * for a user access token. Errors are thrown, not swallowed -- an auth failure here means
 * the login attempt genuinely failed and the caller (the callback route) needs to bounce
 * the user back to /login with an error, not silently proceed unauthenticated.
 */
export async function exchangeOAuthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  fetchFn: FetchFn = fetch
): Promise<string> {
  const response = await fetchFn("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`GitHub OAuth token exchange failed (status ${response.status})`);
  }
  const body = (await response.json()) as AccessTokenResponse;
  if (!body.access_token) {
    throw new Error(`GitHub OAuth token exchange failed: ${body.error_description ?? body.error ?? "no access_token in response"}`);
  }
  return body.access_token;
}

/** Fetches the logged-in user's GitHub profile with their fresh OAuth access token. */
export async function fetchGithubUser(accessToken: string, fetchFn: FetchFn = fetch): Promise<GithubOAuthUser> {
  const response = await fetchFn("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub user fetch failed (status ${response.status})`);
  }
  return (await response.json()) as GithubOAuthUser;
}
