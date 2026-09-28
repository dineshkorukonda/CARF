import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../../config/env";
import { fetchInstallation, signGithubAppJwt } from "../../../../../adapters/github/appInstallClient";
import { getCurrentAccount } from "../../../../../lib/auth";
import { InstallationAlreadyLinkedError, linkInstallation } from "../../../../../lib/accountService";
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
  const contentType = request.headers.get("content-type") || "";
  const accept = request.headers.get("accept") || "";
  const isJson = contentType.includes("application/json") || accept.includes("application/json");

  if (!account) {
    if (isJson) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", env.baseUrl()));
  }

  let installationId = "";
  let returnTo = "";

  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      installationId = String(body.installationId ?? "").trim();
      returnTo = String(body.returnTo ?? "").trim();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  } else {
    const form = await request.formData();
    installationId = String(form.get("installationId") ?? "").trim();
    returnTo = String(form.get("returnTo") ?? "").trim();
  }

  const redirectTarget = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard/installations";

  if (!installationId || !/^\d+$/.test(installationId)) {
    if (isJson) {
      return NextResponse.json({ error: "Invalid installation ID. Must be numeric digits only." }, { status: 400 });
    }
    const sep = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(new URL(`${redirectTarget}${sep}error=invalid_installation_id`, env.baseUrl()));
  }

  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const installation = await fetchInstallation(installationId, appJwt);
    const linked = await linkInstallation(prisma, account.id, installation);

    if (isJson) {
      return NextResponse.json({
        ok: true,
        installation: {
          id: linked.id,
          installationId: linked.installationId,
          targetLogin: linked.targetLogin,
          repositorySelection: linked.repositorySelection,
        },
      });
    }

    return NextResponse.redirect(new URL(redirectTarget, env.baseUrl()));
  } catch (err) {
    if (err instanceof InstallationAlreadyLinkedError) {
      if (isJson) {
        return NextResponse.json({ error: "Installation is already linked to another account" }, { status: 409 });
      }
      const sep = redirectTarget.includes("?") ? "&" : "?";
      return NextResponse.redirect(
        new URL(`${redirectTarget}${sep}error=already_linked_to_another_account`, env.baseUrl())
      );
    }
    console.error(`manual install-link failed for installationId=${installationId}:`, err);
    if (isJson) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "GitHub installation fetch or link failed" },
        { status: 502 }
      );
    }
    const sep = redirectTarget.includes("?") ? "&" : "?";
    return NextResponse.redirect(new URL(`${redirectTarget}${sep}error=install_link_failed`, env.baseUrl()));
  }
}
