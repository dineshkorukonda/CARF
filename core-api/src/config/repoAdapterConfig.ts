import { AdapterSchema, type CarfConfig } from "./carfConfigSchema.js";

/** Normalize connection blobs written by both the setup and verification endpoints. */
export function resolveRepoAdapterConfig(stored: unknown, processName: string | null | undefined, fallback: CarfConfig["adapter"], runtimeKind?: string): CarfConfig["adapter"] {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return fallback;
  const config = { ...stored } as Record<string, unknown>;
  if (!processName && !config.target && !config.name && !config.targets && !config.containerName) return fallback;
  const kind = config.kind ?? config.runtimeAdapter ?? runtimeKind;
  const pm2Evidence = Boolean(processName) ||
    ((config.layout === "git" || config.layout === "releases") && typeof config.cwd === "string");
  if (kind !== "pm2" && kind !== "docker" && !(!kind && pm2Evidence)) {
    throw new Error("Repository runtime is missing or unsupported; explicitly configure an adapter");
  }
  config.kind = kind ?? "pm2";
  delete config.mode;
  delete config.deploymentIntegration;
  delete config.runtimeAdapter;
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
