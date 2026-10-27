import type { CarfConfig } from "../config/carfConfigSchema.js";
import { PM2Adapter } from "./pm2.js";
import { DockerAdapter } from "./docker.js";
import type { RollbackAdapter } from "./rollbackAdapter.js";

/** Shared by initial deployment, recovery, and manual rollback. */
export function buildRuntimeAdapter(config: NonNullable<CarfConfig["adapter"]>, previousRevision: string): RollbackAdapter {
  const first = config.targets?.[0];
  const target = config.target ?? config.containerName ?? (typeof first === "string" ? first : first?.name);
  if (config.kind === "docker") return new DockerAdapter(previousRevision, {
    containerName: target, composeFile: config.composeFile, healthUrl: config.healthUrl,
    startupGraceSeconds: config.startupGraceSeconds, probeCount: config.probeCount,
  });
  return new PM2Adapter(previousRevision, {
    target, targets: config.targets?.map(item => typeof item === "string" ? item : item.name),
    releasesRoot: config.releasesRoot, currentSymlink: config.currentSymlink, cwd: config.cwd,
    buildCommand: config.buildCommand, layout: config.layout, healthUrl: config.healthUrl,
    startupGraceSeconds: config.startupGraceSeconds, sharedPaths: config.sharedPaths, probeCount: config.probeCount,
  });
}

export function dockerDeploymentImage(image: string | undefined, sha: string): string {
  if (!image || (!image.includes("{sha}") && !image.endsWith(`:${sha}`))) {
    throw new Error("Docker deployment requires imageTag containing {sha} or tagged with the exact commit SHA");
  }
  return image.replaceAll("{sha}", sha);
}
