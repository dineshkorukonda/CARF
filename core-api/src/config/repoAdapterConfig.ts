import { AdapterSchema, type CarfConfig } from "./carfConfigSchema.js";

/** Normalize connection blobs written by both the setup and verification endpoints. */
export function resolveRepoAdapterConfig(stored: unknown, processName: string | null | undefined, fallback: CarfConfig["adapter"]): CarfConfig["adapter"] {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return fallback;
  const config = { ...stored } as Record<string, unknown>;
  if (!processName && !config.target && !config.name && !config.targets && !config.containerName) return fallback;
  delete config.mode;
  delete config.deploymentIntegration;
  delete config.runtimeAdapter;
  config.kind = config.kind === "docker" ? "docker" : "pm2";
  config.target = processName || config.target || config.name || config.containerName;
  delete config.name;
  if (config.releasesDir !== undefined) config.releasesRoot = config.releasesDir;
  delete config.releasesDir;
  if (config.sharedDirs !== undefined) config.sharedPaths = config.sharedDirs;
  delete config.sharedDirs;
  const parsed = AdapterSchema.safeParse(config);
  if (!parsed.success) throw new Error("Invalid repository adapter configuration");
  return parsed.data;
}
