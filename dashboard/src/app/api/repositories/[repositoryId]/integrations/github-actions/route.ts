import { NextRequest, NextResponse } from "next/server";
import { handleGithubActionsIntegration, type IntegrationAction } from "../../../../../../lib/githubActionsIntegrationRoute";

type Params = { params: Promise<{ repositoryId: string }> };

/** GET: safe integration status + canonical manual workflow template (no secrets). */
export async function GET(_request: NextRequest, { params }: Params) {
  const { repositoryId } = await params;
  return handleGithubActionsIntegration(repositoryId, "status");
}

/** POST { "action": "install" | "verify" | "reconfigure" | "disable" }. */
export async function POST(request: NextRequest, { params }: Params) {
  const { repositoryId } = await params;
  let body: { action?: unknown };
  try {
    body = (await request.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const allowed: IntegrationAction[] = ["install", "verify", "reconfigure", "disable"];
  if (typeof body.action !== "string" || !allowed.includes(body.action as IntegrationAction)) {
    return NextResponse.json({ error: "action must be one of: install, verify, reconfigure, disable" }, { status: 400 });
  }
  return handleGithubActionsIntegration(repositoryId, body.action as IntegrationAction);
}