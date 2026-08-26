import { NextResponse } from "next/server";
import { env } from "../../../../../config/env";
import { generateOAuthState, OAUTH_STATE_COOKIE } from "../../../../../lib/oauthState";

export async function GET() {
  const state = generateOAuthState();
  const redirectUri = `${env.baseUrl()}/api/auth/github/callback`;

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", env.githubOAuthClientId());
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "read:user");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes -- only needs to survive the GitHub redirect round trip
    path: "/",
  });
  return response;
}
