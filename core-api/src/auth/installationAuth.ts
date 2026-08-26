import { hashApiKey } from "./apiKey.js";

export interface InstallationAuthPrismaClient {
  installationApiKey: {
    findUnique(args: { where: { keyHash: string } }): Promise<{ installationId: string } | null>;
  };
}

const BEARER_PREFIX = "Bearer ";

/**
 * Resolves the caller's `installationId` from a raw `Authorization` header value, or null
 * if the header is missing/malformed or the key isn't recognized. Callers (route handlers)
 * decide what null means for them -- see routes/threshold.ts's dual-mode handling of
 * "no/invalid credential" vs. "valid credential for a different installation."
 */
export async function resolveInstallationFromAuthHeader(
  prisma: InstallationAuthPrismaClient,
  authHeader: string | undefined
): Promise<string | null> {
  if (!authHeader?.startsWith(BEARER_PREFIX)) return null;
  const token = authHeader.slice(BEARER_PREFIX.length).trim();
  if (!token) return null;

  const row = await prisma.installationApiKey.findUnique({ where: { keyHash: hashApiKey(token) } });
  return row?.installationId ?? null;
}
