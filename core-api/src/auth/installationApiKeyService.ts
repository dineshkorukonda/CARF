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
    upsert(args: {
      where: { installationId: string };
      create: { installationId: string; keyHash: string };
      update: { keyHash: string };
    }): Promise<{ id: string }>;
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

/**
 * Unconditionally issues a *new* key for an installation, invalidating any previous one --
 * the counterpart to `ensureApiKeyForInstallation`'s "never overwrite" idempotency. Used
 * by `GET /v1/installations/:installationId/api-key` (issue #64): since only a hash is
 * ever stored, the plaintext genuinely cannot be recovered for an already-issued key, so a
 * caller re-fetching it has no choice but to receive a fresh one. Safe here because the
 * only long-term holder is the dashboard, which always re-fetches on demand rather than
 * caching indefinitely -- core-api itself never authenticates *as* an installation using
 * this key, only validates *callers* presenting one (see routes/threshold.ts).
 */
export async function rotateApiKeyForInstallation(
  prisma: InstallationApiKeyPrismaClient,
  installationId: string
): Promise<{ plaintextKey: string }> {
  const { plaintext, hash } = generateApiKey();
  await prisma.installationApiKey.upsert({
    where: { installationId },
    create: { installationId, keyHash: hash },
    update: { keyHash: hash },
  });
  return { plaintextKey: plaintext };
}
