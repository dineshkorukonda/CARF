import { z } from "zod";

/**
 * Mirrors core-api/src/config/carfConfigSchema.ts's AdapterSchema/CarfConfigSchema --
 * duplicated, not imported, per this package's no-workspace convention (see
 * dashboard/CLAUDE.md). Keep in sync by hand when core-api's schema changes; only the
 * subset the dashboard's config UI actually edits (mode/adapter for #62, classification/
 * threshold for #63) needs to round-trip exactly -- unrecognized/future fields are passed
 * through untouched by carfConfigWriter.ts rather than parsed strictly, so this mirror
 * lagging slightly behind core-api's never corrupts a repo's existing `.carf.yml`.
 */
export const AdapterKindSchema = z.enum(["pm2"]);
export type AdapterKind = z.infer<typeof AdapterKindSchema>;

export type AdapterStatus = "active" | "preview" | "deprecated";

export interface AdapterDescriptor {
  kind: AdapterKind;
  label: string;
  status: AdapterStatus;
  statusBadge: string;
  disabled?: boolean;
  disabledReason?: string;
}

export const ADAPTER_METADATA: Record<AdapterKind, AdapterDescriptor> = {
  pm2: {
    kind: "pm2",
    label: "PM2 Process Manager (Node / VPS)",
    status: "active",
    statusBadge: "Active",
    disabled: false,
  },
};

export const ADAPTER_TARGET_REGEX = /^[a-zA-Z0-9_./:-]+$/;

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

export const AdapterConfigSchema = z
  .object({
    kind: AdapterKindSchema,
    target: z
      .string()
      .min(1)
      .regex(
        ADAPTER_TARGET_REGEX,
        "target must contain only alphanumeric characters, forward slashes, dots, underscores, or dashes"
      )
      .optional(),
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
    layout: z.enum(["releases", "git"]).optional(),
    releasesRoot: z.string().optional(),
    currentSymlink: z.string().optional(),
    sharedPaths: z.array(z.string().min(1)).optional(),
    cwd: z.string().optional(),
    buildCommand: z.string().optional(),
    healthUrl: z.string().optional(),
    startupGraceSeconds: z.number().int().nonnegative().optional(),
    probeCount: z.number().int().positive().optional(),
  })
  .strict()
  .refine((data) => data.target !== undefined || (data.targets !== undefined && data.targets.length > 0), {
    message: "adapter requires either 'target' or 'targets' to be specified",
    path: ["target"],
  });
export type AdapterConfig = z.infer<typeof AdapterConfigSchema>;

export const ModeSchema = z.enum(["standalone", "augment"]);
export type Mode = z.infer<typeof ModeSchema>;

/** All adapter kinds known to dashboard UI */
export const AVAILABLE_ADAPTER_KINDS: readonly AdapterKind[] = [
  "pm2",
];

/** Actively verified production adapter kinds */
export const LIVE_ADAPTER_KINDS: readonly AdapterKind[] = [
  "pm2",
];

/** Mirrors ClassificationChangeTypeSchema (tier1.ts's ChangeType minus "unclassified"). */
export const ClassificationChangeTypeSchema = z.enum(["infra", "dependency", "config", "code", "data"]);
export type ClassificationChangeType = z.infer<typeof ClassificationChangeTypeSchema>;

/** Mirrors ThresholdChangeTypeSchema -- includes data (db migrations). */
export const ThresholdChangeTypeSchema = z.enum(["infra", "dependency", "config", "code", "data"]);
export type ThresholdChangeType = z.infer<typeof ThresholdChangeTypeSchema>;

export const ClassificationRuleSchema = z
  .object({
    type: ClassificationChangeTypeSchema,
    patterns: z.array(z.string().min(1, "pattern can't be empty")).min(1, "at least one pattern is required"),
  })
  .strict();
export type ClassificationRule = z.infer<typeof ClassificationRuleSchema>;

export const ThresholdTypeOverrideSchema = z
  .object({
    baseThreshold: z.number().positive().optional(),
    baseWindow: z.number().positive().optional(),
  })
  .strict();
export type ThresholdTypeOverride = z.infer<typeof ThresholdTypeOverrideSchema>;

export const ThresholdSchema = z
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
export type ThresholdConfig = z.infer<typeof ThresholdSchema>;

export const ClassificationSchema = z
  .object({
    rules: z.array(ClassificationRuleSchema).optional(),
  })
  .strict();
export type ClassificationConfig = z.infer<typeof ClassificationSchema>;
