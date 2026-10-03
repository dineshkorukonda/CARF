import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import { getCarfConfigFile, getRepoFile } from "../../../../adapters/github/contentsClient";
import { listInstallationRepos } from "../../../../adapters/github/reposClient";
import { parseDeclaredMode, resolveRepoMode, repoIdentityKey } from "../../../../lib/deploymentMode";
import { resolveFromLegacy } from "../../../../lib/capabilities";

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
      // Check all repositories granted to this installation (up to 50)
      repoList = allRepos.slice(0, 50).map((r) => ({
        owner: r.owner.login,
        name: r.name,
      }));
    }

    const connections = await prisma.repoConnection.findMany({
      where: { installationId },
      select: {
        owner: true,
        repo: true,
        mode: true,
        deploymentIntegration: true,
        runtimeAdapter: true,
        storedConfig: true,
        installTokenHash: true,
      },
    });
    const connectionByRepo = new Map(
      connections.map((c) => [repoIdentityKey(c.owner, c.repo), c] as const)
    );

    const statuses = await Promise.all(
      repoList.map(async (r) => {
        try {
          const [configFile, workflowFile] = await Promise.all([
            getCarfConfigFile(r.owner, r.name, token).catch(() => null),
            getRepoFile(r.owner, r.name, ".github/workflows/carf.yml", token).catch(() => null),
          ]);

          let yamlMode: string | undefined;
          let yamlDeploymentIntegration: string | undefined;
          let yamlRuntimeAdapter: string | undefined;
          let adapterKind: string | undefined;
          let adapterTarget: string | undefined;

          if (configFile?.content) {
            const modeMatch = configFile.content.match(/mode:\s*["']?([a-zA-Z0-9_-]+)["']?/);
            if (modeMatch) yamlMode = modeMatch[1];

            const depMatch = configFile.content.match(/deploymentIntegration:\s*["']?([a-zA-Z0-9_-]+)["']?/);
            if (depMatch) yamlDeploymentIntegration = depMatch[1];

            const runtimeMatch = configFile.content.match(/runtimeAdapter:\s*["']?([a-zA-Z0-9_-]+)["']?/);
            if (runtimeMatch) yamlRuntimeAdapter = runtimeMatch[1];

            const kindMatch = configFile.content.match(/kind:\s*["']?([a-zA-Z0-9_-]+)["']?/);
            if (kindMatch) adapterKind = kindMatch[1];

            const targetMatch = configFile.content.match(/target:\s*["']?([a-zA-Z0-9_./:@-]+)["']?/);
            if (targetMatch) adapterTarget = targetMatch[1];
          }

          const connection = connectionByRepo.get(repoIdentityKey(r.owner, r.name));
          const mode = connection
            ? resolveRepoMode(connection)
            : parseDeclaredMode(yamlMode) ?? undefined;

          const resolved = resolveFromLegacy({
            mode: connection ? connection.mode : parseDeclaredMode(yamlMode) ?? undefined,
            deploymentIntegration: connection?.deploymentIntegration ?? yamlDeploymentIntegration,
            runtimeAdapter: connection?.runtimeAdapter ?? yamlRuntimeAdapter,
            storedConfig: connection?.storedConfig,
            adapter: adapterKind ? { kind: adapterKind } : undefined,
          });

          return {
            name: r.name,
            fullName: `${r.owner}/${r.name}`,
            isProtected: !!configFile,
            hasWorkflow: !!workflowFile,
            mode,
            deploymentIntegration: resolved.deploymentIntegration,
            runtimeAdapter: resolved.runtimeAdapter,
            capabilities: resolved.capabilities,
            integrationLabel: resolved.integrationLabel,
            runtimeLabel: resolved.runtimeLabel,
            runtimeStatus: resolved.runtimeStatus,
            deploymentStatus: resolved.deploymentStatus,
            requiresAgent: resolved.requiresAgent,
            adapterKind,
            adapterTarget,
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

    return NextResponse.json({
      installationId,
      statuses,
      repositories: statuses,
    });
  } catch (error: unknown) {
    console.error("[api/repo/status] Error checking repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repository statuses from GitHub" },
      { status: 502 }
    );
  }
}
