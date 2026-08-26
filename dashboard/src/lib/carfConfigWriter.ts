import { dump, load } from "js-yaml";
import {
  AdapterConfigSchema,
  ClassificationSchema,
  ModeSchema,
  ThresholdSchema,
  type AdapterConfig,
  type ClassificationConfig,
  type Mode,
  type ThresholdConfig,
} from "./carfConfigSchema";

export class InvalidCarfConfigError extends Error {}

/**
 * Parses `.carf.yml`'s existing text (or null, for a repo with none yet) into a mutable
 * top-level object every `apply*Patch` function starts from -- shared so every patch
 * function fails the same way on a malformed file, and every patch function leaves keys
 * it doesn't own untouched.
 */
function parseExistingConfig(existingYaml: string | null): Record<string, unknown> {
  if (!existingYaml) return {};
  const parsed = load(existingYaml);
  if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
    throw new InvalidCarfConfigError(".carf.yml's top level must be a mapping (an object), not a list or scalar");
  }
  return { ...(parsed as Record<string, unknown>) };
}

/**
 * Every `apply*Patch` function shares this serialization tail: a full round-trip
 * parse+dump, not a text patch, so comments in the original file are NOT preserved
 * (js-yaml doesn't support that; a repo relying on `.carf.yml` comments should expect the
 * dashboard's save to drop them).
 */
function serialize(config: Record<string, unknown>): string {
  return dump(config, { lineWidth: 100, noRefs: true });
}

export interface ModeAdapterPatch {
  mode: Mode;
  /** Required when `mode === "standalone"`; ignored (and any existing value dropped, see
   *  below) when `mode === "augment"`. */
  adapter?: AdapterConfig;
}

/**
 * Merges a mode/adapter patch (issue #62's form) into an existing `.carf.yml`, leaving
 * every other top-level key (`classification`, `threshold`, and anything this dashboard
 * doesn't know about yet) untouched.
 */
export function applyModeAdapterPatch(existingYaml: string | null, patch: ModeAdapterPatch): string {
  const next = parseExistingConfig(existingYaml);

  const mode = ModeSchema.parse(patch.mode);
  next.mode = mode;

  if (mode === "standalone") {
    if (!patch.adapter) {
      throw new InvalidCarfConfigError("adapter is required when mode is standalone");
    }
    next.adapter = AdapterConfigSchema.parse(patch.adapter);
  } else {
    // Augment mode never reads `adapter` -- drop a stale value rather than carry dead
    // config forward (matches issue #50's "avoid a silently-inert selection" ethos).
    delete next.adapter;
  }

  return serialize(next);
}

export interface ClassificationThresholdPatch {
  /** Omitted (or an empty rules array) clears classification.rules entirely -- the key
   *  itself is dropped rather than kept as `{ rules: [] }`, matching ClassificationSchema's
   *  `rules` being optional. */
  classification?: ClassificationConfig;
  /** Omitted clears the threshold key entirely, falling back to DEFAULT_CONFIG. */
  threshold?: ThresholdConfig;
}

/**
 * Merges a classification.rules / threshold patch (issue #63's form) into an existing
 * `.carf.yml`, leaving `mode`/`adapter` and anything else untouched. Both sections are
 * independently optional in `CarfConfigSchema`, so an empty/omitted section here clears
 * that key entirely rather than writing an empty object -- an empty `classification.rules`
 * array and a missing `classification` key are equivalent to core-api's loader, but the
 * latter is what a hand-written `.carf.yml` would actually look like.
 */
export function applyClassificationThresholdPatch(existingYaml: string | null, patch: ClassificationThresholdPatch): string {
  const next = parseExistingConfig(existingYaml);

  if (patch.classification?.rules && patch.classification.rules.length > 0) {
    next.classification = ClassificationSchema.parse(patch.classification);
  } else {
    delete next.classification;
  }

  if (patch.threshold && Object.keys(patch.threshold).length > 0) {
    next.threshold = ThresholdSchema.parse(patch.threshold);
  } else {
    delete next.threshold;
  }

  return serialize(next);
}
