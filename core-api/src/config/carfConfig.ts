import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { CarfConfigSchema, type CarfConfig } from "./carfConfigSchema.js";

/**
 * Thrown when a `.carf.yml` file exists but is malformed (invalid YAML)
 * or fails schema validation. Never thrown for a missing file — that's a
 * valid, non-error state (see loadCarfConfig). This is the "fail closed"
 * half of the contract: callers must not catch this and silently fall
 * back to defaults.
 */
export class InvalidCarfConfigError extends Error {
  constructor(path: string, reason: string) {
    super(`Invalid .carf.yml at ${path}: ${reason}`);
    this.name = "InvalidCarfConfigError";
  }
}

/**
 * Loads and validates `.carf.yml` from `repoRoot` (defaults to
 * `process.cwd()`).
 *
 * Returns `undefined` if no `.carf.yml` exists at `repoRoot` — this is
 * not an error; callers should fall back to their own hardcoded defaults.
 *
 * Throws `InvalidCarfConfigError` if the file exists but is malformed
 * YAML or fails `CarfConfigSchema` validation. Callers must not catch
 * this to fall back to defaults — an existing-but-broken config fails
 * the caller closed (see docs/superpowers/specs/
 * 2026-08-24-carf-yml-config-design.md, "Loading & validation").
 */
export function loadCarfConfig(repoRoot: string = process.cwd()): CarfConfig | undefined {
  const path = join(repoRoot, ".carf.yml");

  if (!existsSync(path)) {
    return undefined;
  }

  const raw = readFileSync(path, "utf-8");

  let parsed: unknown;
  try {
    parsed = loadYaml(raw);
  } catch (error) {
    throw new InvalidCarfConfigError(path, `malformed YAML — ${(error as Error).message}`);
  }

  const result = CarfConfigSchema.safeParse(parsed ?? {});
  if (!result.success) {
    throw new InvalidCarfConfigError(path, result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  return result.data;
}
