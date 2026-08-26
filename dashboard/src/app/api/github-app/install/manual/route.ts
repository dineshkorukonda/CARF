import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../../config/env";
import { fetchInstallation, signGithubAppJwt } from "../../../../../adapters/github/appInstallClient";
import { getCurrentAccount } from "../../../../../lib/auth";
import { linkInstallation } from "../../../../../lib/accountService";
import { prisma } from "../../../../../lib/prisma";

/**
 * Fallback for when GitHub's install flow doesn't redirect back through
 * /api/github-app/install/callback (e.g. the App's Setup URL wasn't configured yet at
 * install time) -- lets an already-logged-in account link an installation it knows the id
 * of directly. Verifies the id is a real installation of *this* App (not just any number)
 * via the App's own JWT before linking, same as the callback route does.
 */
export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.redirect(new URL("/login", env.baseUrl()));
  }

  const form = await request.formData();
  const installationId = String(form.get("installationId") ?? "").trim();

  if (!installationId || !/^\d+$/.test(installationId)) {
    return NextResponse.redirect(new URL("/dashboard?error=invalid_installation_id", env.baseUrl()));
  }

  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const installation = await fetchInstallation(installationId, appJwt);
    await linkInstallation(prisma, account.id, installation);
  } catch (err) {
    console.error(`manual install-link failed for installationId=${installationId}:`, err);
    return NextResponse.redirect(new URL("/dashboard?error=install_link_failed", env.baseUrl()));
  }

  return NextResponse.redirect(new URL("/dashboard", env.baseUrl()));
}
