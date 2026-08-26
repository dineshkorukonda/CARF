import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../../config/env";
import { fetchInstallation, signGithubAppJwt } from "../../../../../adapters/github/appInstallClient";
import { getCurrentAccount } from "../../../../../lib/auth";
import { linkInstallation } from "../../../../../lib/accountService";
import { prisma } from "../../../../../lib/prisma";
import { GITHUB_APP_INSTALL_STATE_COOKIE } from "../../../../../lib/installState";

/**
 * GitHub's "Setup URL" target for the App: it redirects here with `installation_id`,
 * `setup_action` ("install" or "update"), and the `state` we handed `installations/new`.
 */
export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.redirect(new URL("/login", env.baseUrl()));
  }

  const installationId = request.nextUrl.searchParams.get("installation_id");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(GITHUB_APP_INSTALL_STATE_COOKIE)?.value;

  const response = NextResponse.redirect(new URL("/dashboard", env.baseUrl()));

  if (!installationId || !state || !expectedState || state !== expectedState) {
    response.cookies.delete(GITHUB_APP_INSTALL_STATE_COOKIE);
    return NextResponse.redirect(new URL("/dashboard?error=invalid_install_state", env.baseUrl()));
  }

  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const installation = await fetchInstallation(installationId, appJwt);
    await linkInstallation(prisma, account.id, installation);
  } catch {
    response.cookies.delete(GITHUB_APP_INSTALL_STATE_COOKIE);
    return NextResponse.redirect(new URL("/dashboard?error=install_link_failed", env.baseUrl()));
  }

  response.cookies.delete(GITHUB_APP_INSTALL_STATE_COOKIE);
  return response;
}
