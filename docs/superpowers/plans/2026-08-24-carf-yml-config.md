# `.carf.yml` Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per-task GitHub workflow (overrides the sub-skill's default branch/PR handling):**
> Each Task below is one GitHub issue, one branch, one PR — not one combined
> branch for the whole plan. For each task, in order:
> 1. `gh issue create` in `dineshkorukonda/CARF` with the task's title and
>    acceptance criteria (the task's own step list) as the issue body.
> 2. Branch off `main` (e.g. `git checkout -b carf-yml/task-N-<slug>`).
> 3. Work the task's steps as separate commits (not one squashed commit —
>    each `- [ ] **Step N: Commit**` below is its own commit).
> 4. `gh pr create` against `main`, body includes `Closes #<issue-number>`.
> 5. Confirm the `core-api CI` workflow passes on the PR before treating the
>    task as done.
> 6. Only move to the next task after the current PR is open and green.
> Do not merge PRs — leave that to the user (see repo convention). Do not
> add a "Co-Authored-By: Claude" trailer to any commit.

**Goal:** Let a `.carf.yml` file at the repo root tune CARF's Tier 1
classification path rules and threshold/decay parameters without touching
`core-api` source, while defining (but not yet wiring) `mode`/`adapter`
config for a future composition-root project.

**Architecture:** A Zod schema (`config/carfConfigSchema.ts`) defines
`.carf.yml`'s shape. A loader (`config/carfConfig.ts`) does the only file
I/O — find, parse, validate, once — and returns plain data or throws.
`classifier/` functions (`classifyTier1`, `classifyCommit`) and
`threshold/engine.ts`'s `computeThreshold` gain optional plain-data
parameters (mirroring `computeThreshold`'s existing `ThresholdConfig`
parameter) so they stay I/O-free. The evaluation harness
(`evaluation/run.ts`) becomes the first and only real end-to-end call site
that loads `.carf.yml` and threads it through, since no webhook→pipeline
composition root exists yet.

**Tech Stack:** TypeScript (strict), Fastify, Zod (new dependency),
js-yaml (already a dependency, currently unused), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-carf-yml-config-design.md`

## Global Constraints

- `.carf.yml` is optional. No file at the repo root → no error, every
  consumer's existing hardcoded default applies unchanged (byte-identical
  to pre-feature behavior).
- A `.carf.yml` that exists but is invalid (malformed YAML, or fails Zod
  validation) → throw a specific, field-identifying error. This is "fail
  closed" — nothing silently falls back to defaults or partially applies.
- No `github.webhookSecret` (or any secret) field in the schema, ever.
  Webhook auth stays exclusively via `GITHUB_WEBHOOK_SECRET`
  (`core-api/src/config/env.ts`) and
  `core-api/src/adapters/github/webhookSignature.ts`. This is a
  deliberate decision — do not add a secret field even if it seems
  convenient.
- `mode` and `adapter` are schema-validated but **inert** — no code may
  read them to change runtime behavior in this plan. Every place they are
  documented (schema comments, `.carf.example.yml`, README, docs page)
  must say so explicitly.
- Merge semantics: user `classification.rules` are checked before the
  hardcoded `RULES` in `tier1.ts` (first-match-wins overall, user rules
  first). `threshold.decay` / `threshold.complexityDecay` / each
  `threshold.types.<type>.{baseThreshold,baseWindow}` override
  `DEFAULT_CONFIG` per-field — an unspecified field keeps
  `DEFAULT_CONFIG`'s value for that field, not the whole type.
- `classification.rules[].type` is restricted to
  `"infra" | "dependency" | "config" | "code" | "data"` (tier1.ts's
  `ChangeType` minus `"unclassified"`, which is the no-match fallback and
  isn't user-assignable). `threshold.types` keys are restricted to
  `"infra" | "dependency" | "config" | "code"` (threshold/engine.ts's
  narrower `ChangeType`, which excludes `"data"`).
- `classifier/` (`tier1.ts`, `vector.ts`) and `threshold/engine.ts` must
  stay pure — no file reads, no env var reads, no new I/O. They only gain
  additional optional plain-data parameters.
- Single flat `.carf.yml`, no per-environment override blocks.
- Zod version: `^3.24.1`.

---

## Task 1: `.carf.yml` schema + Zod validation + `.carf.example.yml`

**Files:**
- Create: `core-api/src/config/carfConfigSchema.ts`
- Create: `core-api/.carf.example.yml`
- Test: `core-api/test/config/carfConfigSchema.test.ts`
- Modify: `core-api/package.json` (add `zod` dependency)

**Interfaces:**
- Produces: `CarfConfigSchema` (Zod schema, exported), `type CarfConfig =
  z.infer<typeof CarfConfigSchema>`, `type ClassificationChangeType`,
  `type ThresholdChangeType` — all imported by Task 2 (loader), Task 3
  (classifier wiring), Task 4 (threshold merge), Task 5 (evaluation
  harness wiring).

- [ ] **Step 1: Add the `zod` dependency**

```bash
cd core-api && npm install zod@^3.24.1
```

- [ ] **Step 2: Write the failing schema tests**

Create `core-api/test/config/carfConfigSchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CarfConfigSchema } from "../../src/config/carfConfigSchema.js";

describe("CarfConfigSchema", () => {
  it("accepts an empty object (every top-level key optional)", () => {
    const result = CarfConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated valid config", () => {
    const result = CarfConfigSchema.safeParse({
      classification: {
        rules: [{ type: "infra", patterns: ["deploy/**/*.yaml"] }],
      },
      threshold: {
        decay: 0.6,
        complexityDecay: 0.3,
        types: {
          infra: { baseThreshold: 0.01, baseWindow: 60 },
          code: { baseThreshold: 0.08 },
        },
      },
      mode: "standalone",
      adapter: { kind: "kubernetes", target: "my-deployment" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown classification rule type", () => {
    const result = CarfConfigSchema.safeParse({
      classification: { rules: [{ type: "unclassified", patterns: ["*"] }] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects 'data' as a threshold.types key (threshold engine has no data category)", () => {
    const result = CarfConfigSchema.safeParse({
      threshold: { types: { data: { baseThreshold: 0.01 } } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a partial threshold.types entry (only baseThreshold, no baseWindow)", () => {
    const result = CarfConfigSchema.safeParse({
      threshold: { types: { infra: { baseThreshold: 0.02 } } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid mode value", () => {
    const result = CarfConfigSchema.safeParse({ mode: "chaos" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid adapter.kind value", () => {
    const result = CarfConfigSchema.safeParse({
      adapter: { kind: "pm2", target: "x" },
    });
    expect(result.success).toBe(false);
  });

  it("requires patterns to be a non-empty array on a classification rule", () => {
    const result = CarfConfigSchema.safeParse({
      classification: { rules: [{ type: "infra", patterns: [] }] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown top-level key (webhookSecret must never be a valid field)", () => {
    const result = CarfConfigSchema.safeParse({ github: { webhookSecret: "x" } });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd core-api && npx vitest run test/config/carfConfigSchema.test.ts`
Expected: FAIL — `Cannot find module '../../src/config/carfConfigSchema.js'`

- [ ] **Step 4: Implement the schema**

Create `core-api/src/config/carfConfigSchema.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd core-api && npx vitest run test/config/carfConfigSchema.test.ts`
Expected: PASS (all 9 cases)

- [ ] **Step 6: Write `.carf.example.yml`**

Create `core-api/.carf.example.yml`:

```yaml
# .carf.yml — repo-root configuration for core-api. All top-level keys are
# optional. No file at all is valid and produces core-api's built-in
# hardcoded defaults, unchanged.

classification:
  rules:
    # Checked BEFORE core-api's built-in classification rules
    # (src/classifier/tier1.ts), first-match-wins. Omit this block
    # entirely to use only the built-in rules.
    - type: infra
      patterns:
        - "deploy/**/*.yaml"

threshold:
  # Overrides src/threshold/engine.ts's DEFAULT_CONFIG. Any key, or any
  # field within a type, that you omit here falls back to the built-in
  # default for that field.
  decay: 0.6
  complexityDecay: 0.3
  types:
    infra:
      baseThreshold: 0.01
      baseWindow: 60
    # dependency / config / code accept the same { baseThreshold,
    # baseWindow } shape; each omitted type keeps its DEFAULT_CONFIG
    # value entirely.

# --- The two fields below are validated but NOT YET WIRED. Setting them
# --- has NO EFFECT on core-api's runtime behavior today — there is no
# --- code path that reads mode/adapter to actually select Standalone vs
# --- Augment mode or drive a rollback adapter. This will change in a
# --- future project. Until then, treat these as a schema preview, not a
# --- working switch.
mode: standalone   # standalone | augment
adapter:
  kind: kubernetes  # kubernetes | dockerCompose
  target: "my-deployment"
```

- [ ] **Step 7: Run the full core-api test suite and lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add core-api/package.json core-api/package-lock.json \
  core-api/src/config/carfConfigSchema.ts \
  core-api/.carf.example.yml \
  core-api/test/config/carfConfigSchema.test.ts
git commit -m "feat(core-api): add .carf.yml Zod schema + example file"
```

---

## Task 2: Config loader (find/parse/validate `.carf.yml`, fail closed)

**Files:**
- Create: `core-api/src/config/carfConfig.ts`
- Test: `core-api/test/config/carfConfig.test.ts`
- Test fixtures:
  - `core-api/test/config/fixtures/missing/` (empty directory, no `.carf.yml`)
  - `core-api/test/config/fixtures/valid-minimal/.carf.yml`
  - `core-api/test/config/fixtures/valid-full/.carf.yml`
  - `core-api/test/config/fixtures/invalid-syntax/.carf.yml`
  - `core-api/test/config/fixtures/invalid-schema/.carf.yml`

**Interfaces:**
- Consumes: `CarfConfigSchema`, `type CarfConfig` from
  `../src/config/carfConfigSchema.js` (Task 1).
- Produces: `loadCarfConfig(repoRoot?: string): CarfConfig | undefined`
  and `class InvalidCarfConfigError extends Error` from
  `core-api/src/config/carfConfig.ts` — consumed by Task 5
  (`evaluation/run.ts`).

- [ ] **Step 1: Create fixture files**

`core-api/test/config/fixtures/missing/` — create the directory only
(git doesn't track empty dirs; add a `.gitkeep` file inside it so the
directory exists in the repo):

```bash
mkdir -p core-api/test/config/fixtures/missing
touch core-api/test/config/fixtures/missing/.gitkeep
mkdir -p core-api/test/config/fixtures/valid-minimal
mkdir -p core-api/test/config/fixtures/valid-full
mkdir -p core-api/test/config/fixtures/invalid-syntax
mkdir -p core-api/test/config/fixtures/invalid-schema
```

`core-api/test/config/fixtures/valid-minimal/.carf.yml`:

```yaml
threshold:
  decay: 0.6
```

`core-api/test/config/fixtures/valid-full/.carf.yml`:

```yaml
classification:
  rules:
    - type: infra
      patterns: ["deploy/**/*.yaml"]
threshold:
  decay: 0.6
  complexityDecay: 0.25
  types:
    infra:
      baseThreshold: 0.02
      baseWindow: 45
mode: standalone
adapter:
  kind: kubernetes
  target: "my-deployment"
```

`core-api/test/config/fixtures/invalid-syntax/.carf.yml`:

```yaml
threshold:
  decay: 0.6
    complexityDecay: 0.3
```

(the extra indentation before `complexityDecay` makes this invalid YAML)

`core-api/test/config/fixtures/invalid-schema/.carf.yml`:

```yaml
mode: chaos
```

- [ ] **Step 2: Write the failing loader tests**

Create `core-api/test/config/carfConfig.test.ts`:

```ts
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { InvalidCarfConfigError, loadCarfConfig } from "../../src/config/carfConfig.js";

const fixturesDir = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

describe("loadCarfConfig", () => {
  it("returns undefined when .carf.yml is missing (not an error)", () => {
    const result = loadCarfConfig(join(fixturesDir, "missing"));
    expect(result).toBeUndefined();
  });

  it("parses and validates a minimal valid .carf.yml", () => {
    const result = loadCarfConfig(join(fixturesDir, "valid-minimal"));
    expect(result).toEqual({ threshold: { decay: 0.6 } });
  });

  it("parses and validates a fully populated valid .carf.yml", () => {
    const result = loadCarfConfig(join(fixturesDir, "valid-full"));
    expect(result).toEqual({
      classification: {
        rules: [{ type: "infra", patterns: ["deploy/**/*.yaml"] }],
      },
      threshold: {
        decay: 0.6,
        complexityDecay: 0.25,
        types: { infra: { baseThreshold: 0.02, baseWindow: 45 } },
      },
      mode: "standalone",
      adapter: { kind: "kubernetes", target: "my-deployment" },
    });
  });

  it("throws InvalidCarfConfigError on malformed YAML", () => {
    expect(() => loadCarfConfig(join(fixturesDir, "invalid-syntax"))).toThrow(
      InvalidCarfConfigError
    );
  });

  it("throws InvalidCarfConfigError with a field-identifying message on schema violation", () => {
    expect(() => loadCarfConfig(join(fixturesDir, "invalid-schema"))).toThrow(
      InvalidCarfConfigError
    );
    try {
      loadCarfConfig(join(fixturesDir, "invalid-schema"));
      throw new Error("expected loadCarfConfig to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidCarfConfigError);
      expect((error as Error).message).toContain("mode");
    }
  });

  it("defaults repoRoot to process.cwd() when not provided", () => {
    // core-api's own repo root has no .carf.yml today, so this should
    // resolve the same way the "missing" fixture does: undefined, no throw.
    expect(() => loadCarfConfig()).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd core-api && npx vitest run test/config/carfConfig.test.ts`
Expected: FAIL — `Cannot find module '../../src/config/carfConfig.js'`

- [ ] **Step 4: Implement the loader**

Create `core-api/src/config/carfConfig.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd core-api && npx vitest run test/config/carfConfig.test.ts`
Expected: PASS (6 cases)

- [ ] **Step 6: Run the full core-api test suite and lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add core-api/src/config/carfConfig.ts core-api/test/config/carfConfig.test.ts \
  core-api/test/config/fixtures
git commit -m "feat(core-api): add .carf.yml loader with fail-closed validation"
```

---

## Task 3: Wire config into the classification engine

**Files:**
- Modify: `core-api/src/classifier/tier1.ts`
- Modify: `core-api/src/classifier/vector.ts`
- Modify: `core-api/test/classifier/tier1.test.ts`
- Modify: `core-api/test/classifier/vector.test.ts`

**Interfaces:**
- Consumes: `type ClassificationChangeType` from
  `../config/carfConfigSchema.js` (Task 1) — used only as the type for
  each user rule's `type` field, no schema/validation import needed here
  (validation already happened in the loader).
- Produces: `classifyTier1(changedFilePaths: string[], userRules?:
  UserPatternRule[]): Tier1Result` and `classifyCommit(changedFiles:
  CodeFile[], scorer?: CodeComplexityScorer, userRules?:
  UserPatternRule[]): ChangeVector | null` — the `userRules` parameter is
  consumed by Task 5 (`evaluation/runHarness.ts`).
- `export interface UserPatternRule { type: ClassificationChangeType;
  patterns: string[] }` from `tier1.ts`.

- [ ] **Step 1: Write the failing tests for user rule precedence**

Add to `core-api/test/classifier/tier1.test.ts` (inside the existing
`describe("classifyTier1", ...)` block, after the last test):

```ts
  it("checks user rules before the hardcoded rules (first-match-wins, user rules first)", () => {
    // Without a user rule, config/production.yaml is "config" per the
    // hardcoded rules (see the first test in this file).
    const withoutUserRule = classifyTier1(["config/production.yaml"]);
    expect(withoutUserRule.files[0]?.type).toBe("config");

    const withUserRule = classifyTier1(
      ["config/production.yaml"],
      [{ type: "infra", patterns: ["config/production.yaml"] }]
    );
    expect(withUserRule.files[0]?.type).toBe("infra");
  });

  it("falls through to hardcoded rules for paths no user rule matches", () => {
    const result = classifyTier1(
      ["src/handler.ts", "deploy/prod.yaml"],
      [{ type: "infra", patterns: ["deploy/**/*.yaml"] }]
    );
    const typeByPath = Object.fromEntries(result.files.map((f) => [f.path, f.type]));
    expect(typeByPath["deploy/prod.yaml"]).toBe("infra"); // matched by user rule
    expect(typeByPath["src/handler.ts"]).toBe("code"); // matched by hardcoded rule
  });

  it("defaults to no user rules (today's exact hardcoded behavior) when the parameter is omitted", () => {
    const result = classifyTier1(["Dockerfile"]);
    expect(result.files[0]?.type).toBe("infra");
  });
```

Add to `core-api/test/classifier/vector.test.ts` (inside the existing
`describe("classifyCommit", ...)` block, after the last test):

```ts
  it("threads userRules through to Tier 1 classification", () => {
    const vector = classifyCommit(
      [{ path: "config/production.yaml", before: "a", after: "b" }],
      zeroScorer,
      [{ type: "infra", patterns: ["config/production.yaml"] }]
    );
    // Reclassified as infra by the user rule, so it's still the only
    // classified file and infra takes the full weight.
    expect(vector).toEqual({
      infra: 1,
      dependency: 0,
      config: 0,
      code: 0,
      code_complexity: 0,
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd core-api && npx vitest run test/classifier/tier1.test.ts test/classifier/vector.test.ts`
Expected: FAIL — TS error, `classifyTier1`/`classifyCommit` don't accept a
second/third argument of that shape (or a runtime mismatch if TS doesn't
error on extra args — either way, the new assertions fail since the
current implementation ignores the extra argument entirely and the
"infra" reclassification won't happen).

- [ ] **Step 3: Implement the change in `tier1.ts`**

Modify `core-api/src/classifier/tier1.ts`. Add the import and interface
near the top (after the existing `PatternRule` interface), and change
`matchPath` and `classifyTier1`'s signatures:

```ts
import type { ClassificationChangeType } from "../config/carfConfigSchema.js";

export interface UserPatternRule {
  type: ClassificationChangeType;
  patterns: string[];
}
```

Change `matchPath` to accept the combined rule list instead of closing
over the module-level `RULES` constant directly:

```ts
function matchPath(path: string, rules: PatternRule[]): { type: ChangeType; matchedRule: boolean } {
  for (const rule of rules) {
    if (micromatch.isMatch(path, rule.patterns, { dot: true, nocase: true })) {
      return { type: rule.type, matchedRule: true };
    }
  }
  return { type: "unclassified", matchedRule: false };
}
```

Change `classifyTier1`'s signature and body:

```ts
export function classifyTier1(changedFilePaths: string[], userRules: UserPatternRule[] = []): Tier1Result {
  const rules: PatternRule[] = [...userRules, ...RULES];
  const tally = emptyTally();
  const files: FileClassification[] = changedFilePaths.map((path) => {
    const { type, matchedRule } = matchPath(path, rules);
    if (!matchedRule) {
      console.warn(`[tier1] unmatched path, treated as unclassified: ${path}`);
    }
    tally[type] += 1;
    return { path, type };
  });

  const totalFiles = files.reduce((count, f) => (f.type === "unclassified" ? count : count + 1), 0);

  return { files, tally, totalFiles };
}
```

`UserPatternRule` is structurally assignable to `PatternRule` (`type` is
a subset of `ChangeType`, `patterns` matches), so `[...userRules,
...RULES]` type-checks without a cast.

- [ ] **Step 4: Implement the change in `vector.ts`**

Modify `core-api/src/classifier/vector.ts`:

```ts
import { classifyTier1, type Tier1Result, type UserPatternRule } from "./tier1.js";
```

Change `classifyCommit`'s signature and body:

```ts
export function classifyCommit(
  changedFiles: CodeFile[],
  scorer: CodeComplexityScorer = new StubComplexityScorer(),
  userRules: UserPatternRule[] = []
): ChangeVector | null {
  const tier1 = classifyTier1(changedFiles.map((f) => f.path), userRules);
  const codeFiles = changedFiles.filter((f) =>
    tier1.files.some((classified) => classified.path === f.path && classified.type === "code")
  );
  const complexityScore = scorer.score(codeFiles);
  return buildChangeVector(tier1, complexityScore);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd core-api && npx vitest run test/classifier/tier1.test.ts test/classifier/vector.test.ts`
Expected: PASS (all cases, including every pre-existing test — the new
parameters are additive and default to today's behavior)

- [ ] **Step 6: Run the full core-api test suite and lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add core-api/src/classifier/tier1.ts core-api/src/classifier/vector.ts \
  core-api/test/classifier/tier1.test.ts core-api/test/classifier/vector.test.ts
git commit -m "feat(core-api): thread .carf.yml classification rules through Tier 1"
```

---

## Task 4: Wire config into the threshold/decay engine

**Files:**
- Create: `core-api/src/config/mergeThresholdConfig.ts`
- Test: `core-api/test/config/mergeThresholdConfig.test.ts`

**Interfaces:**
- Consumes: `type CarfConfig` (specifically `CarfConfig["threshold"]`)
  from `./carfConfigSchema.js` (Task 1); `DEFAULT_CONFIG`, `type
  ThresholdConfig` from `../threshold/engine.js` (existing).
- Produces: `mergeThresholdConfig(userThreshold: CarfConfig["threshold"]
  | undefined, base?: ThresholdConfig): ThresholdConfig` — consumed by
  Task 5 (`evaluation/run.ts`).

`computeThreshold()` itself is not modified — it already accepts an
optional `ThresholdConfig` (see `core-api/src/threshold/engine.ts:75`).
This task only needs to build the merge function that turns a partial,
user-supplied `.carf.yml` `threshold` block into a complete
`ThresholdConfig` to hand to it.

- [ ] **Step 1: Write the failing merge tests**

Create `core-api/test/config/mergeThresholdConfig.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergeThresholdConfig } from "../../src/config/mergeThresholdConfig.js";
import { DEFAULT_CONFIG } from "../../src/threshold/engine.js";

describe("mergeThresholdConfig", () => {
  it("returns DEFAULT_CONFIG unchanged when userThreshold is undefined", () => {
    expect(mergeThresholdConfig(undefined)).toEqual(DEFAULT_CONFIG);
  });

  it("returns DEFAULT_CONFIG unchanged when userThreshold is an empty object", () => {
    expect(mergeThresholdConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it("overrides decay and complexityDecay scalars", () => {
    const result = mergeThresholdConfig({ decay: 0.6, complexityDecay: 0.9 });
    expect(result.decay).toBe(0.6);
    expect(result.complexityDecay).toBe(0.9);
    expect(result.baseThreshold).toEqual(DEFAULT_CONFIG.baseThreshold);
    expect(result.baseWindow).toEqual(DEFAULT_CONFIG.baseWindow);
  });

  it("overrides only the specified field of a type, keeping the other field's default", () => {
    const result = mergeThresholdConfig({
      types: { infra: { baseThreshold: 0.02 } },
    });
    expect(result.baseThreshold.infra).toBe(0.02);
    expect(result.baseWindow.infra).toBe(DEFAULT_CONFIG.baseWindow.infra); // unspecified, kept
    expect(result.baseThreshold.dependency).toBe(DEFAULT_CONFIG.baseThreshold.dependency); // untouched type
  });

  it("overrides multiple types independently", () => {
    const result = mergeThresholdConfig({
      types: {
        infra: { baseThreshold: 0.02, baseWindow: 45 },
        code: { baseWindow: 1200 },
      },
    });
    expect(result.baseThreshold.infra).toBe(0.02);
    expect(result.baseWindow.infra).toBe(45);
    expect(result.baseWindow.code).toBe(1200);
    expect(result.baseThreshold.code).toBe(DEFAULT_CONFIG.baseThreshold.code); // unspecified, kept
    expect(result.baseThreshold.config).toBe(DEFAULT_CONFIG.baseThreshold.config); // untouched type
  });

  it("accepts an explicit base config other than DEFAULT_CONFIG", () => {
    const customBase = {
      baseThreshold: { infra: 1, dependency: 1, config: 1, code: 1 },
      baseWindow: { infra: 1, dependency: 1, config: 1, code: 1 },
      decay: 1,
      complexityDecay: 1,
    };
    const result = mergeThresholdConfig({ decay: 0.5 }, customBase);
    expect(result.decay).toBe(0.5);
    expect(result.baseThreshold).toEqual(customBase.baseThreshold);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd core-api && npx vitest run test/config/mergeThresholdConfig.test.ts`
Expected: FAIL — `Cannot find module '../../src/config/mergeThresholdConfig.js'`

- [ ] **Step 3: Implement the merge function**

Create `core-api/src/config/mergeThresholdConfig.ts`:

```ts
import { DEFAULT_CONFIG, type ThresholdConfig } from "../threshold/engine.js";
import type { CarfConfig } from "./carfConfigSchema.js";

/**
 * Merges a `.carf.yml` `threshold` block (already schema-validated by
 * carfConfig.ts's loader) over `base` (defaults to DEFAULT_CONFIG),
 * per-field: `decay`/`complexityDecay` override if present, and each
 * `types.<type>.{baseThreshold,baseWindow}` overrides only the fields the
 * user actually specified — an omitted field, or an omitted type
 * entirely, keeps `base`'s value.
 */
export function mergeThresholdConfig(
  userThreshold: CarfConfig["threshold"] | undefined,
  base: ThresholdConfig = DEFAULT_CONFIG
): ThresholdConfig {
  if (!userThreshold) {
    return base;
  }

  const types = userThreshold.types ?? {};

  return {
    decay: userThreshold.decay ?? base.decay,
    complexityDecay: userThreshold.complexityDecay ?? base.complexityDecay,
    baseThreshold: {
      infra: types.infra?.baseThreshold ?? base.baseThreshold.infra,
      dependency: types.dependency?.baseThreshold ?? base.baseThreshold.dependency,
      config: types.config?.baseThreshold ?? base.baseThreshold.config,
      code: types.code?.baseThreshold ?? base.baseThreshold.code,
    },
    baseWindow: {
      infra: types.infra?.baseWindow ?? base.baseWindow.infra,
      dependency: types.dependency?.baseWindow ?? base.baseWindow.dependency,
      config: types.config?.baseWindow ?? base.baseWindow.config,
      code: types.code?.baseWindow ?? base.baseWindow.code,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd core-api && npx vitest run test/config/mergeThresholdConfig.test.ts`
Expected: PASS (6 cases)

- [ ] **Step 5: Run the full core-api test suite and lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core-api/src/config/mergeThresholdConfig.ts core-api/test/config/mergeThresholdConfig.test.ts
git commit -m "feat(core-api): merge .carf.yml threshold config over DEFAULT_CONFIG"
```

---

## Task 5: Wire loaded `.carf.yml` end-to-end into the evaluation harness

**Files:**
- Modify: `core-api/src/evaluation/runHarness.ts`
- Modify: `core-api/src/evaluation/run.ts`
- Modify: `core-api/test/evaluation/harness.test.ts`

**Context:** Per the spec's "Open decisions" section: today, nothing in
`app.ts`/`index.ts` calls `classifyCommit()` or `computeThreshold()` —
`processCommit()` (`pipeline.ts`) has no live caller either. The
evaluation harness (`evaluation/run.ts`'s `main()`, via
`runHarness.ts`'s `runEvaluation()`) is the **one place** these functions
are actually invoked end-to-end today. This task makes that one live call
site load and apply `.carf.yml`, so the config layer built in Tasks 1–4
has a real, testable consumer — without building the (explicitly
out-of-scope) webhook/mode composition root.

**Interfaces:**
- Consumes: `loadCarfConfig` from `../config/carfConfig.js` (Task 2);
  `mergeThresholdConfig` from `../config/mergeThresholdConfig.js` (Task
  4); `type UserPatternRule` from `../classifier/tier1.js` (Task 3).
- Produces: `RunEvaluationOptions` gains `classificationRules?:
  UserPatternRule[]` (alongside its existing `thresholdConfig?` and
  `prismaClient?`).

- [ ] **Step 1: Write the failing test for `classificationRules` threading**

Add to `core-api/test/evaluation/harness.test.ts`, inside the existing
`describe("runEvaluation", ...)` block, after the last test:

```ts
  it("threads classificationRules through to classifyCommit for every deployment", async () => {
    const deployments = generateSyntheticDeployments(10);
    const prismaClient = new FakeEvaluationPrismaClient();

    // A deliberately extreme user rule: reclassify every path as "infra".
    // If classificationRules isn't threaded through, this has no effect
    // and the test below (comparing against a run with no rules) would
    // see identical outcomes.
    const withRule = await runEvaluation(deployments, {
      prismaClient,
      classificationRules: [{ type: "infra", patterns: ["**/*"] }],
    });
    const withoutRule = await runEvaluation(deployments, {
      prismaClient: new FakeEvaluationPrismaClient(),
    });

    // Both runs must still produce finite, well-formed metrics either way.
    expectFiniteMetrics(withRule.conditionB);
    expectFiniteMetrics(withoutRule.conditionB);
    // Forcing every file to "infra" changes the ChangeVector CARF
    // computes for every deployment, which changes the dynamic threshold
    // fed into Condition B — so the two runs' Condition B MTTR should
    // differ (infra carries the tightest, fastest-tripping base
    // threshold/window in DEFAULT_CONFIG).
    expect(withRule.conditionB.truePositiveMttrMs).not.toBe(withoutRule.conditionB.truePositiveMttrMs);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd core-api && npx vitest run test/evaluation/harness.test.ts`
Expected: FAIL — TS error, `classificationRules` is not a valid key of
`RunEvaluationOptions` (or, if TS is lenient here, a runtime failure
because the assertion that MTTR differs won't hold since the option is
silently ignored).

- [ ] **Step 3: Implement the change in `runHarness.ts`**

Modify `core-api/src/evaluation/runHarness.ts`. Add the import:

```ts
import type { UserPatternRule } from "../classifier/tier1.js";
```

Extend `RunEvaluationOptions`:

```ts
export interface RunEvaluationOptions {
  /** Injected Prisma client seam; defaults to the app-wide singleton (src/db/client.ts). */
  prismaClient?: EvaluationPrismaClient;
  /** Threshold engine tuning for Condition B; defaults to DEFAULT_CONFIG. */
  thresholdConfig?: ThresholdConfig;
  /** User classification rules (from .carf.yml), checked before Tier 1's hardcoded rules. Defaults to none. */
  classificationRules?: UserPatternRule[];
}
```

In `runEvaluation`'s body, change:

```ts
    const vector = classifyCommit(deployment.changedFiles);
```

to:

```ts
    const vector = classifyCommit(deployment.changedFiles, undefined, options.classificationRules ?? []);
```

(passing `undefined` for the `scorer` argument still triggers
`classifyCommit`'s own default parameter, `new StubComplexityScorer()` —
JS default parameters apply whenever the argument is `undefined`,
regardless of whether it's omitted or passed explicitly.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd core-api && npx vitest run test/evaluation/harness.test.ts`
Expected: PASS (including all pre-existing tests in this file)

- [ ] **Step 5: Wire `run.ts`'s `main()` to load and apply `.carf.yml`**

Modify `core-api/src/evaluation/run.ts`:

```ts
import { generateSyntheticDeployments } from "./injector.js";
import { runEvaluation } from "./runHarness.js";
import { writeReport } from "./report.js";
import { loadCarfConfig } from "../config/carfConfig.js";
import { mergeThresholdConfig } from "../config/mergeThresholdConfig.js";

// `npm run evaluate` entrypoint. Requires DATABASE_URL, same as any other code path that
// touches the real Prisma client (see src/pipeline.ts) — EvaluationLog rows are written
// for every deployment/condition pair.
const DEPLOYMENT_COUNT = 100;

async function main(): Promise<void> {
  // Loads .carf.yml from the repo root if present (config-only wiring —
  // mode/adapter are validated but unused here; see
  // docs/superpowers/specs/2026-08-24-carf-yml-config-design.md).
  const carfConfig = loadCarfConfig();

  const deployments = generateSyntheticDeployments(DEPLOYMENT_COUNT);
  const results = await runEvaluation(deployments, {
    thresholdConfig: mergeThresholdConfig(carfConfig?.threshold),
    classificationRules: carfConfig?.classification?.rules ?? [],
  });
  const markdown = writeReport(results);
  console.log(markdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

There is no existing test file for `run.ts` (it's a script entrypoint —
`main()` isn't exported and the file isn't covered by the existing suite;
confirm this by checking for `test/evaluation/run.test.ts`, which does
not exist). Do not add one — the meaningful behavior (config threading
into `runEvaluation`) is already covered by Task 5's `runHarness.test.ts`
addition; `run.ts` itself is a thin composition of already-tested pieces.

- [ ] **Step 6: Run the full core-api test suite and lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add core-api/src/evaluation/runHarness.ts core-api/src/evaluation/run.ts \
  core-api/test/evaluation/harness.test.ts
git commit -m "feat(core-api): wire loaded .carf.yml into the evaluation harness"
```

---

## Task 6: Docs — README, docs page, root status table

**Files:**
- Modify: `core-api/README.md`
- Modify: `web/src/app/docs/page.tsx`
- Modify: `README.md` (repo root)

**Interfaces:** None — this task only changes documentation content, no
code.

- [ ] **Step 1: Add a `.carf.yml` section to `core-api/README.md`**

Insert a new section into `core-api/README.md`, after the existing
"## Standalone mode: rollback adapters + health-check loop" section
(after line 72, before EOF):

```markdown

## `.carf.yml` configuration

An optional file at the repo root lets you tune classification and
threshold behavior without touching source. See
[`.carf.example.yml`](.carf.example.yml) for the full annotated schema.
No file at all → core-api runs on its built-in hardcoded defaults,
unchanged.

- `classification.rules` — path-glob rules checked *before*
  `src/classifier/tier1.ts`'s built-in rules (first-match-wins overall).
  Anything not matched by a user rule falls through to the built-in
  rules.
- `threshold` — overrides `src/threshold/engine.ts`'s `DEFAULT_CONFIG`,
  per field: an omitted field (or omitted type) keeps its built-in
  default.
- `mode` / `adapter` — validated against the schema, but **not yet
  wired to any runtime behavior**. There is no composition root today
  that reads `mode` to select Standalone vs Augment behavior or that
  drives a rollback adapter from `adapter.kind`/`adapter.target` — that
  wiring is a separate, future project. Setting these fields today has
  no effect beyond passing validation.

A malformed or schema-invalid `.carf.yml` (bad YAML, unknown field,
invalid enum value) causes the loader (`src/config/carfConfig.ts`) to
throw — this is deliberate "fail closed" behavior, not a bug: an invalid
config must never be silently ignored in favor of defaults.
```

- [ ] **Step 2: Replace the aspirational schema on the docs page with the real one**

In `web/src/app/docs/page.tsx`, the "Configuration Reference (.carf.yml)"
section (starting at line 379) currently shows a schema
(`version`/`project_id`/`sensitivity_rules`/`target.provider`) that does
not match what was actually implemented. Replace it:

Change the status badge and the explanatory paragraph — replace lines
385–393:

```tsx
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-['Lora',Georgia,serif] text-2xl font-semibold text-[#0a0a0a]">
                Configuration Reference (<code className="text-[#111]">.carf.yml</code>)
              </h2>
              <StatusBadge status="Implemented" />
            </div>
            <p className="font-['Inter',system-ui,sans-serif] text-xs text-[#888]">
              An optional file at the repo root. core-api reads <code className="font-mono text-[11px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">classification</code> and <code className="font-mono text-[11px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">threshold</code> to tune Tier 1 path rules and threshold/decay parameters without a code change. <code className="font-mono text-[11px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">mode</code> and <code className="font-mono text-[11px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">adapter</code> below are schema-validated but not yet wired to runtime behavior — there is no composition root yet that reads them to select Standalone vs Augment mode.
            </p>
```

Replace the copy-button `onClick` payload and the `<pre>` block content
(lines 401 and 412–437) with the real schema from
`core-api/.carf.example.yml` (Task 1). Use the exact content of that
file for both the copy-button string (escaped for a JS template literal,
same convention as the existing code — `\n` for newlines) and the `<pre>`
block (unescaped, matching the existing style at lines 412–437).

Also update the status entry in the section list further up the file
(around line 51):

```tsx
    { id: "config-reference", label: "Configuration Reference (.carf.yml)", status: "Implemented" as const },
```

- [ ] **Step 3: Update the repo root `README.md` status table**

In `README.md`, change the `.carf.yml` row (line 30):

```markdown
| `.carf.yml` configuration reference (classification rules + threshold/decay tuning; `mode`/`adapter` schema defined, not yet wired) | Implemented |
```

- [ ] **Step 4: Verify the docs page builds**

Run: `cd web && npm run typecheck && npm run build`
Expected: PASS (no TS/build errors from the JSX changes)

- [ ] **Step 5: Verify core-api still passes lint/typecheck/tests (no code changed, but confirm nothing broke)**

Run: `cd core-api && npm run lint && npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core-api/README.md web/src/app/docs/page.tsx README.md
git commit -m "docs: document .carf.yml — mark Implemented, replace aspirational schema"
```
