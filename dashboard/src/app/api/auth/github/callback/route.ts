import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../../config/env";
import { exchangeOAuthCode, fetchGithubUser } from "../../../../../adapters/github/oauthClient";
import { upsertAccountFromGithubUser } from "../../../../../lib/accountService";
import { prisma } from "../../../../../lib/prisma";
import { OAUTH_STATE_COOKIE } from "../../../../../lib/oauthState";
import { createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_TTL_MS } from "../../../../../lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", env.baseUrl()));
  }

  let response: NextResponse;
  try {
    const redirectUri = `${env.baseUrl()}/api/auth/github/callback`;
    const accessToken = await exchangeOAuthCode(
      code,
      env.githubOAuthClientId(),
      env.githubOAuthClientSecret(),
      redirectUri
    );
    const githubUser = await fetchGithubUser(accessToken);
    const account = await upsertAccountFromGithubUser(prisma, githubUser);

    response = NextResponse.redirect(new URL("/dashboard", env.baseUrl()));
    response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(env.sessionSecret(), account.id), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_MS / 1000,
      path: "/",
    });
  } catch {
    // Auth provider/network failures shouldn't leak details to the client -- just bounce
    // back to /login with a generic error flag.
    response = NextResponse.redirect(new URL("/login?error=oauth_failed", env.baseUrl()));
  }

  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
