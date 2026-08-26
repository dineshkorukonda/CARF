import { generateApiKey } from "./apiKey.js";

/**
 * Minimal seam over the subset of PrismaClient's API this service needs. Mirrors
 * src/pipeline.ts's PipelinePrismaClient convention: real PrismaClient satisfies this
 * structurally, tests inject an in-memory fake.
 */
export interface InstallationApiKeyPrismaClient {
  installationApiKey: {
    findUnique(args: { where: { installationId: string } }): Promise<{ id: string } | null>;
    create(args: { data: { installationId: string; keyHash: string } }): Promise<{ id: string }>;
  };
}

export interface EnsureApiKeyResult {
  created: boolean;
  /** Only set when `created` is true -- the one and only time the plaintext key exists
   *  outside a client's own storage. Callers must log/surface it immediately. */
  plaintextKey?: string;
}

/**
 * Idempotently ensures an installation has an API key: no-ops if one already exists (so
 * redelivered webhooks or a long-lived installation never get a second, silently
 * conflicting key -- rotation is a deliberately separate, not-yet-built concern), creates
 * one otherwise. Called from webhookOrchestrator.ts the moment a real installationId is
 * first seen from GitHub, since that's the earliest point core-api can vouch "yes, a real
 * GitHub App installation with this id exists."
 */
export async function ensureApiKeyForInstallation(
  prisma: InstallationApiKeyPrismaClient,
  installationId: string
): Promise<EnsureApiKeyResult> {
  const existing = await prisma.installationApiKey.findUnique({ where: { installationId } });
  if (existing) {
    return { created: false };
  }

  const { plaintext, hash } = generateApiKey();
  await prisma.installationApiKey.create({ data: { installationId, keyHash: hash } });
  return { created: true, plaintextKey: plaintext };
}
