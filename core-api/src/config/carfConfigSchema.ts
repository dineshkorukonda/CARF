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
    patterns: z.array(z.string().min(1)).min(1),
  })
  .strict();

const ThresholdTypeOverrideSchema = z
  .object({
    baseThreshold: z.number().positive().optional(),
    baseWindow: z.number().int().positive().optional(),
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
  docker: {
    kind: "docker",
    name: "Docker",
    status: "active",
    description: "Docker container and Compose management (actively verified)",
  },
};

/**
 * 3-Layer Architecture Configuration Schemas
 */
export const DeploymentIntegrationSchema = z.enum([
  "github_actions",
  "argo_rollouts",
  "flagger",
  "generic_http",
]);
export type DeploymentIntegrationConfig = z.infer<typeof DeploymentIntegrationSchema>;

export const RuntimeAdapterSchema = z.enum([
  "none",
  "pm2",
  "kubernetes",
  "docker",
  "systemd",
]);
export type RuntimeAdapterConfig = z.infer<typeof RuntimeAdapterSchema>;

/**
 * Supported runtime adapters for automated rollback.
 */
export const AdapterLayoutSchema = z.enum(["releases", "git"]);
export type AdapterLayout = z.infer<typeof AdapterLayoutSchema>;

export const AdapterKindSchema = z.enum(["pm2", "docker"]);
export type AdapterKind = z.infer<typeof AdapterKindSchema>;

export const Pm2TargetConfigSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(
        ADAPTER_TARGET_REGEX,
        "name must contain only alphanumeric characters, forward slashes, dots, underscores, or dashes"
      ),
    healthUrl: z.string().url().optional(),
    startupGraceSeconds: z.number().int().nonnegative().optional(),
    probeCount: z.number().int().positive().optional(),
  })
  .strict();
export type Pm2TargetConfig = z.infer<typeof Pm2TargetConfigSchema>;

export const AdapterSchema = z
  .object({
    kind: AdapterKindSchema,
    /** Single process or container name (alias for targets: [target]) */
    target: z
      .string()
      .min(1)
      .regex(
        ADAPTER_TARGET_REGEX,
        "target must contain only alphanumeric characters, forward slashes, dots, underscores, or dashes"
      )
      .optional(),
    /** Container name alias for Docker adapter */
    containerName: z.string().optional(),
    /** Docker compose manifest path */
    composeFile: z.string().optional(),
    /** Image tag to deploy or rollback */
    imageTag: z.string().optional(),
    previousImageTag: z.string().optional(),
    /** Multiple PM2 process names (strings or target objects) */
    targets: z
      .array(
        z.union([
          z
            .string()
            .min(1)
            .regex(
              ADAPTER_TARGET_REGEX,
              "each target must contain only alphanumeric characters, forward slashes, dots, underscores, or dashes"
            ),
          Pm2TargetConfigSchema,
        ])
      )
      .min(1)
      .optional(),
    /** Working directory of the target app on host */
    cwd: z.string().optional(),
    /** Deployment directory layout */
    layout: AdapterLayoutSchema.optional(),
    /** Absolute path to releases root directory (required when layout: "releases") */
    releasesRoot: z.string().optional(),
    /** Absolute path to current symlink (required when layout: "releases") */
    currentSymlink: z.string().optional(),
    /** Paths to symlink into every release (optional, layout: "releases") */
    sharedPaths: z.array(z.string()).optional(),
    /** Optional shell command to run after git checkout (layout: "git" only) */
    buildCommand: z.string().optional(),
    /** Seconds to wait after restart before first health probe */
    startupGraceSeconds: z.number().int().nonnegative().optional(),
    /** HTTP health check URL probed before and after reload */
    healthUrl: z.string().url().optional(),
    /** Number of consecutive successful probes required to declare healthy */
    probeCount: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.target !== undefined ||
      data.containerName !== undefined ||
      (data.targets !== undefined && data.targets.length > 0),
    {
      message: "adapter requires either 'target', 'containerName', or 'targets' to be specified",
      path: ["target"],
    }
  );

export const AnalysisTriggerSchema = z.enum(["commits", "pull_requests", "both"]);

export const CarfConfigSchema = z
  .object({
    classification: ClassificationSchema.optional(),
    analysisTrigger: AnalysisTriggerSchema.optional(),
    threshold: ThresholdSchema.optional(),
    mode: z.enum(["augment", "standalone"]).optional(),
    deploymentIntegration: DeploymentIntegrationSchema.optional(),
    runtimeAdapter: RuntimeAdapterSchema.optional(),
    adapter: AdapterSchema.optional(),
  })
  .strict()
  .refine((data) => !(data.mode === "standalone" && data.adapter === undefined), {
    message: "adapter configuration is required when mode is 'standalone'",
    path: ["adapter"],
  });

export type CarfConfig = z.infer<typeof CarfConfigSchema>;
