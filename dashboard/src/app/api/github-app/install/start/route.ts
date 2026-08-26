import { NextResponse } from "next/server";
import { env } from "../../../../../config/env";
import { getCurrentAccount } from "../../../../../lib/auth";
import { generateOAuthState, GITHUB_APP_INSTALL_STATE_COOKIE } from "../../../../../lib/oauthState";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.redirect(new URL("/login", env.baseUrl()));
  }

  const state = generateOAuthState();
  const installUrl = new URL(`https://github.com/apps/${env.githubAppSlug()}/installations/new`);
  installUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(installUrl);
  response.cookies.set(GITHUB_APP_INSTALL_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
