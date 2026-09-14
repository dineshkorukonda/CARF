import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import { getCarfConfigFile, getRepoFile } from "../../../../adapters/github/contentsClient";
import { listInstallationRepos } from "../../../../adapters/github/reposClient";

export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get("installationId");
  const targetRepo = searchParams.get("repo"); // optional: "owner/repo" or "repo"

  if (!installationId) {
    return NextResponse.json({ error: "Missing installationId parameter" }, { status: 400 });
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found" }, { status: 404 });
  }

  try {
    const token = await mintInstallationToken(installationId);
    let repoList: { owner: string; name: string }[] = [];

    if (targetRepo) {
      if (targetRepo.includes("/")) {
        const [owner, name] = targetRepo.split("/");
        repoList = [{ owner: owner!, name: name! }];
      } else {
        repoList = [{ owner: installation.targetLogin, name: targetRepo }];
      }
    } else {
      const allRepos = await listInstallationRepos(token);
      // Cap at checking top 15 most recent repos to keep request snappy
      repoList = allRepos.slice(0, 15).map((r) => ({
        owner: r.owner.login,
        name: r.name,
      }));
    }

    const statuses = await Promise.all(
      repoList.map(async (r) => {
        try {
          const [configFile, workflowFile] = await Promise.all([
            getCarfConfigFile(r.owner, r.name, token).catch(() => null),
            getRepoFile(r.owner, r.name, ".github/workflows/carf.yml", token).catch(() => null),
          ]);

          let mode: string | undefined;
          if (configFile?.content) {
            const match = configFile.content.match(/mode:\s*([a-zA-Z0-9_-]+)/);
            if (match) mode = match[1];
          }

          return {
            name: r.name,
            fullName: `${r.owner}/${r.name}`,
            isProtected: !!configFile,
            hasWorkflow: !!workflowFile,
            mode: mode ?? (configFile ? "balanced" : undefined),
          };
        } catch {
          return {
            name: r.name,
            fullName: `${r.owner}/${r.name}`,
            isProtected: false,
            hasWorkflow: false,
          };
        }
      })
    );

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("[api/repo/status] Failed to fetch statuses:", error);
    return NextResponse.json({ error: "Failed to check repository statuses" }, { status: 500 });
  }
}
