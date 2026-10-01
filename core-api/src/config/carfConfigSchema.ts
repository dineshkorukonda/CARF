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
 * Matches threshold/engine.ts's ChangeType (infra, dependency, config, code, data).
 */
export const ThresholdChangeTypeSchema = z.enum(["infra", "dependency", "config", "code", "data"]);
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
        data: ThresholdTypeOverrideSchema.optional(),
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

export const ADAPTER_TARGET_REGEX = /^[a-zA-Z0-9_./:-]+$/;

export type AdapterStatus = "active" | "preview" | "deprecated";

export interface AdapterDescriptor {
  kind: string;
  name: string;
  status: AdapterStatus;
  description: string;
}

export const ADAPTER_REGISTRY: Record<string, AdapterDescriptor> = {
  pm2: {
    kind: "pm2",
    name: "PM2",
    status: "active",
    description: "PM2 process manager cluster reload (actively verified)",
  },
};

/**
 * `mode: "standalone"` with `adapter.kind: "pm2"` is wired to a `runStandaloneLoop()`
 * kickoff by `src/webhookOrchestrator.ts`'s `handleWebhookCommit()`.
 * PM2 is the only supported standalone adapter.
 */
export const AdapterLayoutSchema = z.enum(["releases", "git"]);
export type AdapterLayout = z.infer<typeof AdapterLayoutSchema>;

export const Pm2TargetConfigSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(
        ADAPTER_TARGET_REGEX,
        "target name must contain only alphanumeric characters, forward slashes, dots, underscores, or dashes"
      ),
    healthUrl: z.string().optional(),
    startupGraceSeconds: z.number().int().nonnegative().optional(),
  })
  .strict();
export type Pm2TargetConfig = z.infer<typeof Pm2TargetConfigSchema>;

export const AdapterSchema = z
  .object({
    kind: z.literal("pm2"),
    /** Single PM2 process name (alias for targets: [target]) */
    target: z
      .string()
      .min(1)
      .regex(
        ADAPTER_TARGET_REGEX,
        "target must contain only alphanumeric characters, forward slashes, dots, underscores, or dashes"
      )
      .optional(),
    /** Multiple PM2 process names (strings or target objects) */
    targets: z
      .array(
        z.union([
          z
            .string()
            .min(1)
            .regex(
              ADAPTER_TARGET_REGEX,
              "targets must contain only alphanumeric characters, forward slashes, dots, underscores, or dashes"
            ),
          Pm2TargetConfigSchema,
        ])
      )
      .min(1)
      .optional(),
    /** Deployment layout: "releases" (symlink) or "git" (in-place checkout) */
    layout: AdapterLayoutSchema.optional(),
    /** Root directory containing release directories for "releases" layout. Default: /var/www/releases */
    releasesRoot: z.string().optional(),
    /** Symlink path for "releases" layout. Default: /var/www/current */
    currentSymlink: z.string().optional(),
    /** Shared paths (files or directories) preserved across releases */
    sharedPaths: z.array(z.string().min(1)).optional(),
    /** Working directory for "git" layout */
    cwd: z.string().optional(),
    /** Reinstall or build command to run after git checkout on rollback (for "git" layout) */
    buildCommand: z.string().optional(),
    /** Optional HTTP health check URL or endpoint */
    healthUrl: z.string().optional(),
    /** Startup grace period in seconds before readiness evaluation. Default: 60 */
    startupGraceSeconds: z.number().int().nonnegative().optional(),
    /** Number of HTTP probes per poll interval */
    probeCount: z.number().int().positive().optional(),
  })
  .strict()
  .refine((data) => data.target !== undefined || (data.targets !== undefined && data.targets.length > 0), {
    message: "adapter requires either 'target' or 'targets' to be specified",
    path: ["target"],
  });

export const CarfConfigSchema = z
  .object({
    classification: ClassificationSchema.optional(),
    threshold: ThresholdSchema.optional(),
    mode: z.enum(["standalone", "augment"]).optional(),
    adapter: AdapterSchema.optional(),
  })
  .strict();

export type CarfConfig = z.infer<typeof CarfConfigSchema>;
