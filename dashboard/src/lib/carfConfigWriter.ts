import { dump, load } from "js-yaml";
import { AdapterConfigSchema, ModeSchema, type AdapterConfig, type Mode } from "./carfConfigSchema";

export class InvalidCarfConfigError extends Error {}

export interface ModeAdapterPatch {
  mode: Mode;
  /** Required when `mode === "standalone"`; ignored (and any existing value dropped, see
   *  below) when `mode === "augment"`. */
  adapter?: AdapterConfig;
}

/**
 * Merges a mode/adapter patch (issue #62's form) into an existing `.carf.yml`'s parsed
 * content, leaving every other top-level key (`classification`, `threshold`, and anything
 * this dashboard doesn't know about yet) byte-for-byte untouched aside from normal
 * YAML re-serialization -- this is a full round-trip parse+dump, not a text patch, so
 * comments in the original file are NOT preserved (js-yaml doesn't support that; a repo
 * relying on `.carf.yml` comments should expect the dashboard's save to drop them).
 *
 * `existingYaml` is null when the repo has no `.carf.yml` yet (a brand-new config).
 */
export function applyModeAdapterPatch(existingYaml: string | null, patch: ModeAdapterPatch): string {
  const parsed = existingYaml ? load(existingYaml) : {};
  const base = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  if (existingYaml && (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null)) {
    throw new InvalidCarfConfigError(".carf.yml's top level must be a mapping (an object), not a list or scalar");
  }

  const mode = ModeSchema.parse(patch.mode);
  const next: Record<string, unknown> = { ...base, mode };

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

  return dump(next, { lineWidth: 100, noRefs: true });
}
