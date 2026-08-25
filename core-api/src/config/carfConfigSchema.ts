import { z } from "zod";

/**
 * Matches tier1.ts's ChangeType minus "unclassified" — that value is the
 * no-match fallback computed by the classifier, never something a user
 * assigns via a rule.
 */
export const ClassificationChangeTypeSchema = z.enum([
  "infra",
  "dependency",
  "config",
  "code",
  "data",
]);
export type ClassificationChangeType = z.infer<typeof ClassificationChangeTypeSchema>;

/**
 * Matches threshold/engine.ts's (narrower) ChangeType, which excludes
 * "data" — the threshold decay formula only has four contribution
 * categories.
 */
export const ThresholdChangeTypeSchema = z.enum(["infra", "dependency", "config", "code"]);
export type ThresholdChangeType = z.infer<typeof ThresholdChangeTypeSchema>;

const ClassificationRuleSchema = z
  .object({
    type: ClassificationChangeTypeSchema,
    patterns: z.array(z.string()).min(1),
  })
  .strict();

const ThresholdTypeOverrideSchema = z
  .object({
    baseThreshold: z.number().positive().optional(),
    baseWindow: z.number().positive().optional(),
  })
  .strict();

const ThresholdSchema = z
  .object({
    decay: z.number().min(0).max(1).optional(),
    complexityDecay: z.number().min(0).max(1).optional(),
    types: z
      .object({
        infra: ThresholdTypeOverrideSchema.optional(),
        dependency: ThresholdTypeOverrideSchema.optional(),
        config: ThresholdTypeOverrideSchema.optional(),
        code: ThresholdTypeOverrideSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const ClassificationSchema = z
  .object({
    rules: z.array(ClassificationRuleSchema).optional(),
  })
  .strict();

/**
 * `mode: "standalone"` with `adapter.kind: "kubernetes"`, `"dockerCompose"`, or `"pm2"` is
 * wired to a real `runStandaloneLoop()` kickoff by `src/webhookOrchestrator.ts`'s
 * `handleWebhookCommit()` (see issues #49, #50, #51). `adapter.target` is the Kubernetes
 * Deployment name, Docker Compose service name, or PM2 process name to roll back; for
 * `dockerCompose`/`pm2`, the previous image tag / release SHA is derived from the
 * webhook's `baseSha` rather than a config field, and both are restricted to `push` events
 * only (see `webhookOrchestrator.ts`'s `defaultRollbackAdapterFactory` for why).
 *
 * Deliberately no `github.webhookSecret` (or any secret) field — webhook
 * auth is exclusively env-var-sourced (GITHUB_WEBHOOK_SECRET, see
 * config/env.ts), never file-based. See docs/superpowers/specs/
 * 2026-08-24-carf-yml-config-design.md's "Explicitly out of scope" section for why.
 */
const AdapterSchema = z
  .object({
    kind: z.enum(["kubernetes", "dockerCompose", "pm2"]),
    target: z.string().min(1),
  })
  .strict();

export const CarfConfigSchema = z
  .object({
    classification: ClassificationSchema.optional(),
    threshold: ThresholdSchema.optional(),
    mode: z.enum(["standalone", "augment"]).optional(),
    adapter: AdapterSchema.optional(),
  })
  .strict();

export type CarfConfig = z.infer<typeof CarfConfigSchema>;
