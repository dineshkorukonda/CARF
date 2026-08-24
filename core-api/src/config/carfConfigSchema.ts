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
 * `mode` and `adapter` are validated here but INERT — no code in core-api
 * reads them to change runtime behavior yet. There is no composition root
 * wiring the GitHub webhook route, processCommit(), and
 * runStandaloneLoop() together (see docs/superpowers/specs/
 * 2026-08-24-carf-yml-config-design.md, "Explicitly out of scope"). A
 * user who sets `mode: standalone` today gets a validated file, not a
 * running standalone loop.
 *
 * Deliberately no `github.webhookSecret` (or any secret) field — webhook
 * auth is exclusively env-var-sourced (GITHUB_WEBHOOK_SECRET, see
 * config/env.ts), never file-based. See the spec's "Explicitly out of
 * scope" section for why.
 */
const AdapterSchema = z
  .object({
    kind: z.enum(["kubernetes", "dockerCompose"]),
    target: z.string().min(1),
  })
  .strict();

export const CarfConfigSchema = z
  .object({
    classification: ClassificationSchema.optional(),
    threshold: ThresholdSchema.optional(),
    /** Inert — see AdapterSchema doc comment above. */
    mode: z.enum(["standalone", "augment"]).optional(),
    /** Inert — see AdapterSchema doc comment above. */
    adapter: AdapterSchema.optional(),
  })
  .strict();

export type CarfConfig = z.infer<typeof CarfConfigSchema>;
