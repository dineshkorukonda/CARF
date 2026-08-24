# Composition root: webhook → classify → threshold → mode branch — design

Status: approved for planning

## 1. Problem

`core-api` has every pure piece of the pipeline built and independently
tested: the GitHub App webhook receiver (signature verification, payload
parsing), Tier 1 + Tier 2 classification (`classifyTier1`/`classifyCommit`),
the threshold engine (`computeThreshold`), Prisma persistence
(`processCommit`), the `.carf.yml` config loader (`loadCarfConfig`), the
Standalone-mode adapters (`runStandaloneLoop` + `KubectlAdapter`/
`DockerComposeAdapter`), and the Augment-mode `GET /v1/threshold` endpoint.

Nothing in `app.ts`/`index.ts` actually calls these in sequence on a real
incoming webhook:

- `registerGithubWebhookRoute` exists (with an `onValidWebhook` callback
  hook) but is never registered in `buildApp()`.
- Nothing implements `onValidWebhook`.
- `GitHubApiClient` and the GitHub App JWT-signing/token-exchange
  interfaces (`InstallationTokenExchangeClient`, `JwtSigner`) have **no
  concrete implementation** — only interfaces, mocked in tests. There is
  no JWT library dependency in `package.json` today.
- `.carf.yml`'s `mode`/`adapter` fields are schema-validated but
  deliberately inert (see
  `docs/superpowers/specs/2026-08-24-carf-yml-config-design.md`,
  "Explicitly out of scope") — this project is what makes them do
  something.
- `processCommit()`'s `classifyCommit()` call doesn't thread through
  `.carf.yml`'s `classification.rules` — that gap was closed for the
  evaluation harness in the `.carf.yml` project but never for the one
  real live-webhook call path.

This project wires all of that together into one live path: a real
webhook POST triggers signature verification → diff acquisition →
classification → threshold computation → persistence → an HTTP response,
and, in Standalone mode, an additional asynchronous rollback-monitoring
loop.

## 2. Scope

**In scope:**
- Real `GitHubApiClient`, `JwtSigner`, `InstallationTokenExchangeClient`
  implementations (HTTP/JWT, no network in tests).
- A new composition-root module that sequences diff acquisition →
  `processCommit()` → mode branch.
- `processCommit()` gains `baseSha`, `installationId`, and
  `classificationRules` options (additive, existing behavior unchanged
  when omitted).
- `buildApp()` gains a `webhook?` option (mirrors the existing
  `threshold?` option) and registers the webhook route when provided.
- `index.ts` becomes the one place that loads `.carf.yml` once at
  startup, builds the real GitHub adapters, and wires the real
  `onValidWebhook` callback.
- Standalone-mode kickoff of `runStandaloneLoop`, gated to
  `adapter.kind: "kubernetes"` only, with a process-local idempotency
  guard against redelivery.
- Unit tests for every new piece, with `fetch`/`exec`/Prisma all
  injectable — no live network or DB calls in the test suite.

**Explicitly out of scope:**
- Docker Compose support for the Standalone loop kickoff.
  `DockerComposeAdapter`'s constructor requires a `previousImageTag: string`
  that `.carf.yml`'s `AdapterSchema` (`{ kind, target }`) has no field for
  — `KubectlAdapter` doesn't need this because `kubectl rollout undo`
  tracks revision history itself, but Docker Compose has no equivalent.
  Supplying `previousImageTag` requires an actual schema decision (a new
  `.carf.yml` field, or a documented assumption like "image tag equals
  base SHA"), which is schema design work, not wiring. `adapter.kind:
  "dockerCompose"` in Standalone mode logs an "unsupported adapter" error
  and skips the loop kickoff — `processCommit`'s classify/persist result
  still succeeds. A follow-up issue tracks extending the schema.
- Durable/multi-instance idempotency for the Standalone loop guard. The
  in-memory `Set<string>` guard (see §6) is process-local and silently
  stops protecting against double-kickoff the moment core-api runs as
  more than one instance. This is a known, written-down limitation (see
  §6), not an oversight — deferred until there's real multi-instance
  pressure.
- Retry/backoff logic beyond GitHub's own webhook redelivery.
- `.carf.yml` hot-reload — still loaded once at process startup.
- Any change to `.carf.yml`'s schema itself (that's the Docker Compose
  follow-up's job, not this project's).

## 3. New real GitHub App adapters

All under `core-api/src/adapters/github/`, alongside the existing
interfaces they implement. New dependency: `jsonwebtoken` (plus
`@types/jsonwebtoken`) — **not** `jose`. `JwtSigner.sign()`
(`installationTokenClient.ts`) is a **synchronous** interface
(`sign(appId, privateKey): string`, no `Promise`), and
`InstallationTokenClient.getInstallationToken()` calls it unawaited:
`const appJwt = this.jwtSigner.sign(...)`. `jose`'s signing API is
fully async (`SignJWT.sign()` returns a `Promise`), which would require
changing this already-tested interface and its consumer —
out of scope. `jsonwebtoken`'s `jwt.sign(payload, privateKey, options)`
returns a string synchronously when called without a callback, fitting
the existing interface with zero changes to
`installationTokenClient.ts` or its tests.

- **`realJwtSigner.ts`** — `RealJwtSigner implements JwtSigner`. Signs a
  ~10-minute GitHub App JWT (`iat` implicit, `exp` via `expiresIn:
  "10m"`, `iss: appId`) with RS256 via `jsonwebtoken`'s synchronous
  `jwt.sign(...)`, from the PEM string returned by
  `env.githubAppPrivateKey()`.
- **`realInstallationTokenExchangeClient.ts`** —
  `RealInstallationTokenExchangeClient implements
  InstallationTokenExchangeClient`. `POST
  https://api.github.com/app/installations/{id}/access_tokens` with
  `Authorization: Bearer <appJwt>`, via `fetch` (global, Node 22 — no new
  HTTP dependency). Throws a typed `HttpError` (reusing the shape already
  defined in `githubApiClient.ts`) on a non-2xx response.
- **`httpGithubApiClient.ts`** — `HttpGithubApiClient implements
  GitHubApiClient`.
  - `compareCommits`: `GET
    /repos/{owner}/{repo}/compare/{base}...{head}`, maps the response's
    `files[]` to `{ filename, status }`. Single page only — GitHub's
    compare endpoint returns up to 300 changed files per response with
    no pagination support on this endpoint; a commit touching more than
    300 files sees a truncated diff. Documented limitation, not handled
    in this project (no realistic synthetic/manual test case produces
    that many files).
  - `getContent`: `GET /repos/{owner}/{repo}/contents/{path}?ref={ref}`,
    base64-decodes the response `content` field. A 404 response is
    mapped to a rejected promise carrying `HttpError{status: 404}` — the
    exact shape `diffAcquisition.ts`'s existing `isNotFound()` check
    already expects, so `diffAcquisition.ts` needs zero changes.
  - `fetch` is a constructor-injectable option (default: global
    `fetch`), matching the existing `ExecFn` DI convention in
    `kubectl.ts`/`dockerCompose.ts` — tests inject a fake, never hit the
    network.
- **`client.ts`** — a singleton module, analogous to `db/client.ts`'s
  `prisma` export: constructs `RealJwtSigner` +
  `RealInstallationTokenExchangeClient` + `InstallationTokenClient` (the
  existing caching wrapper) from `env`, plus a `HttpGithubApiClient`
  instance. Exports `{ githubApiClient, installationTokenClient }`.

## 4. `processCommit()` additive changes (`pipeline.ts`)

```ts
export interface ProcessCommitOptions {
  prismaClient?: PipelinePrismaClient;
  thresholdConfig?: ThresholdConfig;
  /** NEW — real base SHA/installation ID from a webhook payload. Both default to
   *  today's exact behavior (baseSha: "", installationId omitted) when not supplied,
   *  so every existing caller/test is unaffected. */
  baseSha?: string;
  installationId?: string;
  /** NEW — .carf.yml's classification.rules, checked before Tier 1's hardcoded rules
   *  (mirrors the identical parameter already threaded through
   *  evaluation/runHarness.ts's RunEvaluationOptions). Defaults to none. */
  classificationRules?: UserPatternRule[];
}
```

`classifyCommit(changedFiles)` becomes `classifyCommit(changedFiles,
undefined, options.classificationRules ?? [])`. The `Commit.upsert` call's
`create` payload uses `options.baseSha ?? ""` and
`options.installationId` (omitted/`undefined` maps to Prisma's existing
nullable `installationId` column — no schema migration needed, the column
already exists per `prisma/schema.prisma`).

## 5. New composition root: `src/webhookOrchestrator.ts`

```ts
export interface WebhookOrchestratorDeps {
  githubApiClient: GitHubApiClient;
  installationTokenClient: InstallationTokenClient;
  /** Loaded once at startup (index.ts) — undefined means no .carf.yml, all defaults. */
  carfConfig: CarfConfig | undefined;
  prismaClient?: PipelinePrismaClient;
  /** Testable seam; defaults to `(target) => new KubectlAdapter()`. */
  rollbackAdapterFactory?: (target: string) => RollbackAdapter;
  /** Testable seam; defaults to the real runStandaloneLoop. */
  standaloneLoopRunner?: typeof runStandaloneLoop;
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

export async function handleWebhookCommit(
  target: DeployTarget,
  deps: WebhookOrchestratorDeps
): Promise<void>
```

Sequence:
1. `installationTokenClient.getInstallationToken(target.installationId)`.
2. `acquireDiff(githubApiClient, target.owner, target.repo,
   target.baseSha, target.headSha, token)`.
3. `processCommit(target.headSha, \`${target.owner}/${target.repo}\`,
   changedFiles, { prismaClient, baseSha: target.baseSha, installationId:
   target.installationId, thresholdConfig:
   mergeThresholdConfig(carfConfig?.threshold), classificationRules:
   carfConfig?.classification?.rules ?? [] })`, wrapped in a `try/catch`
   that catches `NoSignalError` specifically: logs
   `logger.info("no classification signal, skipping threshold", { sha,
   fileCount: changedFiles.length })` (this is the point raised in
   review — a no-op here must be distinguishable in logs from "the
   GitHub API silently returned garbage") and returns. Any other thrown
   error propagates uncaught — this is deliberate (see §7).
4. If `carfConfig?.mode !== "standalone"`: return (Augment mode, or no
   `.carf.yml`/no `mode` set — the default — both stop here; `GET
   /v1/threshold` serves Augment separately).
5. If `carfConfig.adapter?.kind !== "kubernetes"`:
   `logger.error("standalone mode configured but adapter is missing or
   unsupported", { adapter: carfConfig.adapter })` and return — the
   `processCommit` result from step 3 has already persisted successfully
   at this point, so this is a partial-success path, not a failure of
   the webhook itself.
6. Otherwise, kick off the guarded, fire-and-forget loop (§6).

## 6. Standalone loop kickoff + idempotency guard

```ts
// Process-local only — see "Explicitly out of scope" (§2) for why this doesn't
// survive a restart or protect against more than one core-api instance.
const activeLoops = new Set<string>();

function loopKey(owner: string, repo: string, sha: string): string {
  return `${owner}/${repo}@${sha}`;
}
```

Inside `handleWebhookCommit`, after step 5 passes:

```ts
const key = loopKey(target.owner, target.repo, target.headSha);
if (activeLoops.has(key)) {
  logger.info("standalone loop already running for this commit, skipping redelivery", { key });
  return;
}
activeLoops.add(key);

// KubectlAdapter's optional `namespace` has no source in .carf.yml's AdapterSchema
// ({ kind, target } only) — the default factory omits it, so kubectl resolves
// against its current context's default namespace. Not a bug: same category of
// gap as the Docker Compose previousImageTag issue (§2), just one that happens to
// have a workable default instead of a hard blocker, so it doesn't need a follow-up.
const adapter = (deps.rollbackAdapterFactory ?? ((t) => new KubectlAdapter()))(carfConfig.adapter.target);
const loopRunner = deps.standaloneLoopRunner ?? runStandaloneLoop;

void loopRunner(target.headSha, adapter, thresholdResult, carfConfig.adapter.target)
  .catch((err) => logger.error("standalone rollback loop failed", { err, key }))
  .finally(() => activeLoops.delete(key));
```

The `.catch()` is not optional cleanup — it is the thing that prevents an
unhandled promise rejection from a fire-and-forget async call (which,
depending on Node's `--unhandled-rejections` setting, can crash the
process). It is written as part of the same expression as the kickoff,
not left implicit. `handleWebhookCommit` itself returns (and the webhook
responds) without awaiting `loopRunner` at all.

## 7. Error handling summary

| Failure point | Behavior |
|---|---|
| Signature/payload validation | Unchanged: 401 / 200 "ignored" |
| Diff acquisition, classification, DB writes (steps 1–3, awaited) | Uncaught (except `NoSignalError`, handled explicitly) → propagates to Fastify's default error handler → 500 → GitHub's own redelivery/backoff retries. No custom retry logic is built. |
| `NoSignalError` | Caught, logged at info level with commit/file-count context, clean early return — not a failure |
| Standalone adapter missing/unsupported (step 5) | `processCommit`'s result already persisted; logged at error level; webhook still responds 200/202; loop simply doesn't start |
| Standalone loop itself throws (post-kickoff, unawaited) | Caught by the dedicated `.catch()` in §6, logged, guard cleared in `.finally()` — never reaches the webhook's request/response cycle, never an unhandled rejection |

## 8. Wiring into `app.ts` / `index.ts`

`buildApp()`:
```ts
export interface BuildAppOptions {
  threshold?: ThresholdRouteOptions;
  webhook?: GithubWebhookRouteOptions;
}
```
registers `registerGithubWebhookRoute` when `options.webhook` is
provided (mirrors the existing optional `threshold` registration).

`index.ts` becomes the sole real-startup composition point:
1. `const carfConfig = loadCarfConfig();` — throws (crashes startup) on
   an invalid `.carf.yml`, inheriting the existing fail-closed contract
   from the `.carf.yml` project. No new behavior here.
2. Import the `client.ts` singleton for `{ githubApiClient,
   installationTokenClient }`.
3. `buildApp({ webhook: { webhookSecret: env.githubWebhookSecret(),
   onValidWebhook: (target) => handleWebhookCommit(target, {
   githubApiClient, installationTokenClient, carfConfig, logger: app.log
   }) } })`.

## 9. Testing

- Each new adapter (`realJwtSigner`, `realInstallationTokenExchangeClient`,
  `httpGithubApiClient`) gets unit tests with injected `fetch`, no
  network, following the existing `ExecFn`-injection pattern.
- `webhookOrchestrator.test.ts` covers, with fake
  `GitHubApiClient`/`InstallationTokenClient`/`PipelinePrismaClient` and
  an injected `standaloneLoopRunner`/`rollbackAdapterFactory`:
  - Augment mode (and no `.carf.yml`/no `mode`) stops after persisting,
    never calls the loop runner.
  - Standalone + `adapter.kind: "kubernetes"` calls the loop runner with
    the right adapter/target/threshold.
  - Standalone + missing/`dockerCompose` adapter logs and skips, but
    `processCommit`'s persistence still happened.
  - Calling `handleWebhookCommit` twice for the same commit while the
    first loop is still "running" (simulated via a controllable fake
    `standaloneLoopRunner` promise) skips the second kickoff.
  - A `standaloneLoopRunner` that rejects doesn't propagate out of
    `handleWebhookCommit` and clears the guard afterward (proves the
    `.catch()`/`.finally()` from §6 actually exist and work).
  - `NoSignalError` from `processCommit` results in a clean return, not
    a thrown error.
- `pipeline.test.ts` gains cases for the new `baseSha`/`installationId`/
  `classificationRules` options, following the exact pattern
  `harness.test.ts` used for the equivalent evaluation-harness change.
- `app.test.ts`/existing smoke test: confirms `buildApp({ webhook })`
  actually registers `POST /webhooks/github`.

## 10. Follow-up (not this project)

File a GitHub issue for extending `.carf.yml`'s `AdapterSchema` to
support Docker Compose (needs a `previousImageTag` source — either a new
schema field or a documented convention), referenced from this spec but
not blocking it.
