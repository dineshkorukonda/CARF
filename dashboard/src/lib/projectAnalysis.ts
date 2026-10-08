import { load } from "js-yaml";
import { AnalysisTriggerSchema, type AnalysisTrigger } from "./carfConfigSchema";
import { getCarfConfigFile } from "../adapters/github/contentsClient";
import { mintInstallationToken } from "./installationAccess";
import { listInstallationsForAccount } from "./accountService";
import { findRepoConnectionSafe } from "./repoConnectionService";
import { prisma } from "./prisma";

export async function resolveProjectInstallation(accountId: string, owner: string, repo: string) {
  const installations = await listInstallationsForAccount(prisma, accountId, { prune: false });
  const connection = await findRepoConnectionSafe(installations.map((item) => item.installationId), owner, repo);
  return connection?.installationId ?? null;
}

export async function readProjectAnalysisTrigger(installationId: string, owner: string, repo: string): Promise<AnalysisTrigger> {
  const token = await mintInstallationToken(installationId);
  const file = await getCarfConfigFile(owner, repo, token);
  if (!file) return "both";
  const config = load(file.content);
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Invalid .carf.yml");
  return AnalysisTriggerSchema.parse((config as Record<string, unknown>).analysisTrigger ?? "both");
}
