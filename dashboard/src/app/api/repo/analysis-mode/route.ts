import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { resolveProjectInstallation, readProjectAnalysisTrigger } from "../../../../lib/projectAnalysis";

export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  if (!owner || !repo) return NextResponse.json({ error: "Owner and repo required" }, { status: 400 });
  try {
    const installationId = await resolveProjectInstallation(account.id, owner, repo);
    if (!installationId) return NextResponse.json({ error: "Project not authorized" }, { status: 403 });
    return NextResponse.json({ analysisTrigger: await readProjectAnalysisTrigger(installationId, owner, repo) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Analysis settings unavailable" }, { status: 503 });
  }
}
