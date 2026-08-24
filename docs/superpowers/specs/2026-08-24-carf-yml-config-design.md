# `.carf.yml` configuration reference — design

Status: approved for planning
Date: 2026-08-24

## Purpose

`core-api` today hardcodes every tunable: Tier 1 classification path globs
(`core-api/src/classifier/tier1.ts`), threshold/decay parameters
(`core-api/src/threshold/engine.ts`), and there is no mode-selection or
adapter-selection mechanism at all. This spec defines `.carf.yml`, a
repo-root config file letting a user tune classification rules and
threshold/decay behavior without touching `core-api` source, and defines
(but does not wire up) the schema for mode selection and rollback adapter
config.

## Scope

**In scope:**
- `.carf.yml` schema definition (Zod) + `.carf.example.yml` documentation
- A config loader (`core-api/src/config/carfConfig.ts`): discover, parse,
  validate `.carf.yml` at startup; fail closed on invalid config
- Threading the loaded config into `classifyTier1()` / `classifyCommit()`
  (classification rules) and `computeThreshold()` (threshold/decay params)
  as optional parameters, mirroring the existing `ThresholdConfig` pattern
- Docs updates (`core-api/README.md`, `web/src/app/docs/page.tsx`, repo
  root `README.md` status table)

**Explicitly out of scope (separate future project):**
- Building the Standalone/Augment mode composition root. Today nothing in
  `app.ts` or `index.ts` wires the GitHub webhook route, `processCommit()`,
  or `runStandaloneLoop()` together — each exists as an independently
  tested unit with no runtime composition. `.carf.yml`'s `mode` and
  `adapter` fields are defined and validated in this project so the schema
  is forward-complete, but **no code reads them to change runtime
  behavior yet**. This must be called out unambiguously in
  `.carf.example.yml` and in the schema's doc comments — a team that
  writes `.carf.yml` today and sets `mode: standalone` should not assume
  flipping that value does anything until the composition-root project
  ships. Every doc surface that mentions `mode`/`adapter` must say this
  explicitly (see "Documentation" below).
- Webhook secret management. `.carf.yml` does **not** get a
  `github.webhookSecret` (or equivalent) field. Webhook authenticity is
  already fully handled by GitHub App signature verification
  (`core-api/src/adapters/github/webhookSignature.ts`), sourced from
  `GITHUB_WEBHOOK_SECRET` via `core-api/src/config/env.ts` — an env var,
  never a file. This is a deliberate decision, not an oversight: CARF's
  hosted multi-tenant direction means a per-repo webhook secret must be
  generated/managed per GitHub App installation, not pasted by a user into
  a file that routinely gets committed to a (sometimes public) repo. A
  literal secret in `.carf.yml` is a footgun for the hosted product later.
  If self-hosted deployments ever need a distinct mechanism, that's a
  separate decision to make explicitly then — not a field to sneak into
  this schema now.
- Per-environment overrides (staging vs prod tuning). YAGNI for now — one
  flat file. Can be added later as an additive, non-breaking schema change
  (e.g. a top-level `environments:` block) if it's ever needed.
- Arbitrary custom change types. `classification.rules[].type` and
  `threshold.types` keys are constrained to the existing closed
  `ChangeType` set. No mechanism for a user to invent a new type name.

## Schema

`.carf.yml` lives at the repo root. All top-level keys are optional; an
absent or empty file is valid and produces today's exact hardcoded
behavior (see "Merge semantics").

```yaml
# .carf.yml — all keys optional. Absent file = today's hardcoded defaults.

classification:
  rules:
    # Ordered, first-match-wins, evaluated BEFORE the hardcoded hardcoded
    # rules in tier1.ts. `type` is restricted to the closed ChangeType set
    # below — "unclassified" is the no-match fallback and cannot be
    # assigned here.
    - type: infra          # infra | dependency | config | code | data
      patterns:
        - "deploy/**/*.yaml"

threshold:
  # Overrides for src/threshold/engine.ts's DEFAULT_CONFIG. Any key/type
  # omitted falls back to the hardcoded default for that key/type.
  decay: 0.6
  complexityDecay: 0.3
  types:
    infra:
      baseThreshold: 0.01
      baseWindow: 60
    # dependency / config / code follow the same shape; each omitted type
    # keeps DEFAULT_CONFIG's value for that type.

# --- Defined for schema completeness. NOT YET WIRED. Setting these today
# --- has NO effect on core-api's runtime behavior — there is no
# --- composition root that reads them. See "Explicitly out of scope"
# --- above. This will change in a future project; until then these are
# --- validated but inert.
mode: standalone   # standalone | augment
adapter:
  kind: kubernetes  # kubernetes | dockerCompose
  target: "my-deployment"
```

### Types (Zod-inferred)

```ts
type ChangeType = "infra" | "dependency" | "config" | "code" | "data";
// matches core-api/src/classifier/tier1.ts's ChangeType minus "unclassified"

interface CarfConfig {
  classification?: {
    rules?: Array<{ type: ChangeType; patterns: string[] }>;
  };
  threshold?: {
    decay?: number;
    complexityDecay?: number;
    types?: Partial<Record<
      "infra" | "dependency" | "config" | "code",   // ThresholdConfig's ChangeType (no "data")
      { baseThreshold?: number; baseWindow?: number }
    >>;
  };
  mode?: "standalone" | "augment";       // validated, inert — see scope note
  adapter?: {                            // validated, inert — see scope note
    kind: "kubernetes" | "dockerCompose";
    target: string;
  };
}
```

Note the type mismatch between `classification.rules[].type` (5-way,
includes `data`) and `threshold.types` keys (4-way, matches
`threshold/engine.ts`'s `ChangeType` which excludes `data` — `data` isn't
one of the threshold engine's four contribution categories). This mirrors
the existing split between `classifier/tier1.ts`'s `ChangeType` and
`threshold/engine.ts`'s `ChangeType`, which are already two distinct types
in the codebase today (see `threshold/engine.ts:9` docstring). Not a new
inconsistency introduced by this spec — the schema just reflects the
distinction that's already there.

## Merge semantics

- **Classification rules:** user-defined rules in `classification.rules`
  are prepended to `tier1.ts`'s hardcoded `RULES` array, so they're
  checked first (still first-match-wins overall). Any path not matched by
  a user rule falls through to the existing hardcoded rules unchanged.
- **Threshold/decay:** `threshold.decay` and `threshold.complexityDecay`
  override `DEFAULT_CONFIG`'s scalars if present. `threshold.types.<type>`
  overrides that type's `baseThreshold`/`baseWindow` if present; any type
  not mentioned (or a partially-specified type, e.g. only
  `baseThreshold`) keeps `DEFAULT_CONFIG`'s value for the unspecified
  field.
- **No file at all:** loader returns `undefined`; every consumer's
  existing default parameter (`DEFAULT_CONFIG`, hardcoded `RULES`) applies
  exactly as it does today. This is a hard requirement — behavior for a
  repo with no `.carf.yml` must be byte-identical to pre-this-feature
  behavior.

## Loading & validation

- New file: `core-api/src/config/carfConfig.ts`, alongside the existing
  `config/env.ts`.
- Responsibilities: locate `.carf.yml` at the repo root, read it, parse
  with `js-yaml` (already a dependency, currently unused), validate with a
  Zod schema, and produce a fully-defaulted-and-merged config object (or
  the pieces needed by each consumer — exact return shape is an
  implementation-plan decision, not a spec decision).
- **File missing:** not an error. Loader returns a value indicating "no
  user config" (e.g. `undefined`); callers fall back to hardcoded
  defaults exactly as they do today.
- **File present but invalid** (malformed YAML, Zod validation failure,
  unknown `classification.rules[].type`, etc.): throw with a clear,
  specific error message (which field, what was wrong). Caller (`index.ts`
  at startup) does not catch this — the process fails to start. This is
  the "fail closed" behavior: an operator who edits `.carf.yml` and
  breaks it finds out immediately at deploy/startup, not via silently
  falling back to defaults or misbehaving at runtime.
- Called once, at startup, from `index.ts`. The resulting config (or its
  relevant slices) is passed down to whatever builds the classifier/
  threshold call sites — exact plumbing (constructor injection vs a
  module-level singleton vs passed through `buildApp`) is an
  implementation-plan decision.

## Keeping `classifier/` pure

`core-api/CLAUDE.md` requires `classifier/` to do no I/O — every function
must be unit-testable with in-memory fixtures only, and `classifyCommit()`
is the single entry point the rest of the app calls. Loading `.carf.yml`
is file I/O, so it cannot live inside `classifier/`.

This is resolved the same way `threshold/engine.ts` already resolves it
for `computeThreshold()`: the I/O (file read + parse + validate) happens
once in `config/carfConfig.ts`, and the *resulting plain data* is passed
in as an optional parameter:

- `classifyTier1(changedFilePaths, userRules?)` — `userRules` defaults to
  `[]` (today's hardcoded `RULES` behavior unchanged).
- `classifyCommit(...)` gains a corresponding optional parameter it
  threads through to `classifyTier1`.
- `computeThreshold(vector, config?)` already takes an optional
  `ThresholdConfig` — the config loader's merged threshold config is
  passed here the same way `pipeline.ts`'s `ProcessCommitOptions.
  thresholdConfig` already allows today.

No function in `classifier/` gains a file read, an env var read, or any
new I/O — they only gain an additional plain-data parameter with a
default matching current behavior.

## Documentation

Every place `mode`/`adapter` are documented must state they are
schema-only today:

- `.carf.example.yml`: inline comment directly above `mode:` (see Schema
  section above) — copy that comment verbatim or equivalent.
- `core-api/README.md`: a note in whatever section documents `.carf.yml`
  stating mode/adapter are validated but not yet wired to runtime
  behavior, with a forward pointer ("mode selection will be wired up in a
  future project").
- `web/src/app/docs/page.tsx`: same caveat, matching that page's existing
  style for "Planned"/"Partial" capabilities.
- Root `README.md` status table: `.carf.yml configuration reference`
  moves from `Planned` to `Implemented`, but the row's description (or an
  adjacent note) should not claim mode switching works — phrase it as
  "config file for classification rules + threshold tuning; mode/adapter
  fields defined, not yet wired."

## Testing

Standard TDD per `core-api/CLAUDE.md` and the repo-wide Superpowers
default:
- `config/carfConfig.ts`: unit tests for missing file, valid file (each
  merge case), invalid YAML, invalid schema (per-field), covering both
  Zod's error surface and the loader's own error wrapping.
- `classifyTier1`/`classifyCommit`: unit tests confirming user rules are
  checked before hardcoded rules, and that omitting `classification` in
  config falls through unchanged.
- `computeThreshold`: unit tests confirming partial `threshold.types`
  overrides (one field of a type) correctly merge rather than clobber the
  other field's default.
- No network/DB/filesystem mocking needed beyond the loader itself reading
  a real fixture file from a test-scoped temp path (or an injectable
  read function, if that's simpler to test with — implementation-plan
  decision).

## Open decisions explicitly deferred to the implementation plan

- Exact return shape of `carfConfig.ts`'s loader (single `CarfConfig`
  object vs pre-split per-consumer slices).
- Exact injection mechanism for passing the loaded config into whatever
  currently calls `classifyCommit()`/`computeThreshold()`/`processCommit()`
  (there is no current caller in `app.ts`/`index.ts` — per pipeline.ts,
  `processCommit()` isn't invoked from the webhook route yet either, so
  this config loading has no live call site to wire into beyond tests and
  the evaluation harness until the composition-root project lands. The
  plan should decide whether to also update `evaluation/runHarness.ts` /
  `evaluation/run.ts` to optionally use a loaded config, since that's the
  one place `computeThreshold`/`classifyCommit` are actually invoked
  end-to-end today).
- File discovery strategy (repo root only vs walking up from cwd).

## Self-review notes

- No placeholders/TBDs remain.
- Internal consistency checked: the `ChangeType` 5-way vs 4-way split is
  flagged explicitly rather than silently glossed over, since it could
  otherwise read as a spec error.
- Scope check: this is right-sized for one implementation plan / a
  handful of GitHub issues, matching the user's proposed ~6-issue
  breakdown (schema+validation, loader, wire into classifier, wire into
  threshold engine, wire into mode/adapter *schema* only, docs).
- Ambiguity check: "fail closed" and "optional file" are both defined
  precisely (missing file = ok, invalid file = throw at startup) so they
  can't be conflated during implementation.
