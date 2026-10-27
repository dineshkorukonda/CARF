export interface RuntimeConnection {
  owner: string;
  repo: string;
  pm2Process?: string | null;
  storedConfig?: unknown;
}

export function configuredPm2Targets(connection: RuntimeConnection): string[] {
  const stored = connection.storedConfig && typeof connection.storedConfig === "object"
    ? connection.storedConfig as Record<string, unknown> : {};
  const config = stored.adapter && typeof stored.adapter === "object"
    ? stored.adapter as Record<string, unknown> : stored;
  const targets: unknown[] = [connection.pm2Process, config.target, config.name,
    ...(Array.isArray(config.targets) ? config.targets.map(target =>
      typeof target === "object" && target ? target.name : target) : [])];
  return targets.filter((target): target is string => typeof target === "string" && target.length > 0);
}
