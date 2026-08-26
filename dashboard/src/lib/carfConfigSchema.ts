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
export const AdapterKindSchema = z.enum(["kubernetes", "dockerCompose", "pm2", "gitops", "dockerSwarm"]);
export type AdapterKind = z.infer<typeof AdapterKindSchema>;

export const AdapterConfigSchema = z
  .object({
    kind: AdapterKindSchema,
    target: z.string().min(1),
  })
  .strict();
export type AdapterConfig = z.infer<typeof AdapterConfigSchema>;

export const ModeSchema = z.enum(["standalone", "augment"]);
export type Mode = z.infer<typeof ModeSchema>;

/** Every adapter kind webhookOrchestrator.ts's defaultRollbackAdapterFactory actually
 *  builds today -- see #50's "avoid letting a user pick an adapter that silently no-ops"
 *  acceptance criterion. Keep this list in sync with core-api's wiring, not just its
 *  schema (the schema can validate a kind before it's live-wired -- see #73/#74's history
 *  of exactly that gap). */
export const LIVE_ADAPTER_KINDS: readonly AdapterKind[] = [
  "kubernetes",
  "dockerCompose",
  "pm2",
  "gitops",
  "dockerSwarm",
];
