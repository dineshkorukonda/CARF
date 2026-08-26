# core-api

CARF's classification + decision engine. See `CLAUDE.md` for architecture/conventions
and `../docs/CARF_PROPOSED_IMPLEMENTATION.md` for the full design spec.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL / GitHub App credentials
npm run dev
```

## Scripts

- `npm run dev` — start the Fastify server with hot reload
- `npm test` — run the Vitest suite
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` / `npm start` — compile and run the production build

## Standalone mode: rollback adapters + health-check loop

`src/adapters/loop.ts` (`runStandaloneLoop`) polls a `RollbackAdapter` at a configurable
interval for the duration of a commit's `ThresholdResult.finalWindow`, triggering
`adapter.rollback()` and exiting early the moment `checkHealth()` reports an error rate
at or above `finalThreshold`. Adapters implementing `RollbackAdapter`:

- `src/adapters/dockerCompose.ts` — `DockerComposeAdapter`, shells out to the `docker
  compose` CLI. `checkHealth` reads `docker compose ps --format json <target>` and derives
  `errorRate` from the fraction of containers that aren't `State: running` or whose
  `Health` isn't `"healthy"`. `rollback` redeploys a configured previous image tag via
  `IMAGE_TAG=<tag> docker compose up -d <target>` (assumes the compose file pins the
  service image to `${IMAGE_TAG}`).
- `src/adapters/kubectl.ts` — `KubectlAdapter`, shells out to `kubectl`. `checkHealth`
  reads `kubectl get deployment <target> -o json` and derives `errorRate` from
  `status.unavailableReplicas / spec.replicas`. `rollback` runs
  `kubectl rollout undo deployment/<target>`.
- `src/adapters/pm2.ts` — `PM2Adapter`, shells out to `pm2`. `checkHealth` reads `pm2
  jlist`, filters to entries whose `name` matches `target`, and derives `errorRate` from
  the fraction whose `pm2_env.status` isn't `"online"`. `rollback` assumes a
  Capistrano-style release layout (`${releasesRoot}/${sha}`, default `/var/www/releases`)
  reached through a `currentSymlink` (default `/var/www/current`): it repoints the symlink
  at the previous release and runs `pm2 reload <target>`.
- `src/adapters/gitops.ts` — `GitOpsAdapter`, backed by Argo CD's REST API (requires
  `ARGOCD_BASE_URL`/`ARGOCD_AUTH_TOKEN`, see `.env.example`). `checkHealth` reads
  `GET /api/v1/applications/<target>`; `errorRate` is binary (1 unless
  `status.health.status === "Healthy"`). `rollback` looks up the target's deployment
  history for the entry matching the previous revision and calls Argo CD's rollback
  endpoint with that entry's id.
- `src/adapters/dockerSwarm.ts` — `DockerSwarmAdapter`, shells out to `docker service`.
  `checkHealth` reads `docker service ps <target> --filter desired-state=running --format
  json` and derives `errorRate` from the fraction of tasks whose `CurrentState` doesn't
  start with `"Running"`. `rollback` runs `docker service update --rollback <target>` —
  Swarm tracks the previous spec itself, no previous-version bookkeeping needed.

All exec-based adapters take an injectable exec function (defaulting to Node's real
`child_process.exec`, promisified), and `GitOpsAdapter` takes an injectable fetch
function, so unit tests never shell out or hit the network for real — see
`test/adapters/dockerCompose.test.ts`, `test/adapters/kubectl.test.ts`,
`test/adapters/pm2.test.ts`, `test/adapters/gitops.test.ts`, and
`test/adapters/dockerSwarm.test.ts`.

### Manual validation against `demo-target-app/`

As of this writing, `demo-target-app/` does not yet exist in this repo. Once it (or an
equivalent throwaway service) is added, validate standalone mode against it manually —
this isn't covered by the automated (mocked) unit tests, which don't touch a real Docker
daemon or Kubernetes cluster:

**Docker Compose**
1. `cd demo-target-app && docker compose up -d` to bring up a known-good version.
2. Deploy a "bad" build (e.g. one that fails its `HEALTHCHECK` or exits) and note its
   compose service name as `target`.
3. Run `runStandaloneLoop` (or a small script wrapping it) with a `DockerComposeAdapter`
   constructed with the previous good image tag, a short `pollIntervalMs`, and the
   `ThresholdResult` for the commit under test.
4. Confirm: `docker compose ps` shows the bad container as unhealthy, the loop detects
   the breach within one poll interval, and `docker compose ps` afterward shows the
   service running the previous image tag again.
5. Repeat with a build that stays healthy for the whole window and confirm no rollback
   occurs (`rolledBack: false`).

**kubectl**
1. Point `kubectl` at a disposable cluster/namespace (e.g. `kind` or `minikube`) with
   `demo-target-app`'s Deployment applied.
2. Roll out a bad revision (e.g. a bad image or one that fails readiness probes).
3. Run `runStandaloneLoop` with a `KubectlAdapter` targeting that Deployment.
4. Confirm: `kubectl get deployment <target>` shows `unavailableReplicas > 0` while bad,
   the loop rolls back via `kubectl rollout undo`, and `kubectl rollout status
   deployment/<target>` afterward shows the previous revision healthy again.
5. Repeat with a healthy rollout and confirm the loop runs the full window with no
   rollback.

## Telemetry: rollout outcome history

`runStandaloneLoop`'s return value now includes `finalErrorRate` and `durationMs`
alongside `rolledBack`. `webhookOrchestrator.ts` persists every successful loop completion
as a `RolloutOutcome` row (`src/adapters/rolloutOutcome.ts`), scoped by `installationId`
from day one even though nothing queries it yet — see the model's doc comment in
`prisma/schema.prisma`.

**Still no query endpoint over this table.** Now that issue #65 has landed a real
per-installation auth mechanism (see below), a `RolloutOutcome` list endpoint is a
reasonable follow-up — it just hasn't been built yet.

## Multi-tenant auth: installation API keys (issue #65)

`Commit`/`Threshold` rows carry an `installationId` (nullable — see PR #49), but until
this issue nothing enforced it on the read side: `GET /v1/threshold?commit=<sha>` looked
up a `Threshold` purely by SHA. Since a commit SHA isn't secret (visible in any git log,
PR, or CI output), one tenant could read another tenant's threshold data by guessing or
observing a SHA the moment more than one real installation shared a core-api deployment.

**Decided mechanism:** an opaque, per-installation bearer API key (`InstallationApiKey` in
`prisma/schema.prisma`, hashed at rest with SHA-256 — see `src/auth/apiKey.ts`'s doc
comment for why a fast hash is fine here). `webhookOrchestrator.ts` auto-issues one
(`src/auth/installationApiKeyService.ts`) the first time a signature-verified webhook
arrives for a given `installationId` — the earliest point core-api can vouch that
installation is real — and logs the plaintext key exactly once (`grep` your logs for
`"issued a new installation API key"` right after a repo's first webhook).

**Retrieval (issue #64):** since only a hash is ever stored, that plaintext genuinely can't
be recovered from the log line alone forever. `GET /v1/installations/:installationId/api-key`
(`src/routes/installationApiKey.ts`) lets a caller who can prove App-level control — an
`Authorization: Bearer <GitHub App JWT>` header, verified by handing it straight to
GitHub's own `GET /app/installations` rather than checking the signature locally —
**rotate** in a fresh key at any time (the old one stops working the moment a new one is
issued; see that route's doc comment for why rotation, not read, is the only option here).
The dashboard is the intended caller: it holds the same App private key core-api does and
fetches+caches a key the first time an installation's status view (#64) needs one.

**`GET /v1/threshold`'s dual-mode auth:**
- No `Authorization` header → only returns commits with `installationId: null` (i.e.
  self-hosted/local/dev setups that never wired up a real GitHub App installation — there's
  no tenant to leak across, so today's unauthenticated behavior is preserved exactly).
- `Authorization: Bearer <installation API key>` → scopes the lookup to that key's own
  `installationId`. A SHA belonging to a *different* installation (or no installation at
  all) 404s — indistinguishable from an unknown SHA, so a guess can't even confirm another
  tenant's commit exists.
- An `Authorization` header with an unrecognized key → `401`, distinct from the two cases
  above (a caller who tried to authenticate and got it wrong isn't the same as one who
  didn't try).

See `test/routes/threshold.test.ts`'s "multi-tenant isolation" describe block (plus its
live-Postgres counterpart) for the two-installations-can't-read-each-other's-data proof
required by this issue's acceptance criteria.

## `GET /v1/commits` — recent commit status (issue #64)

The list endpoint the dashboard's live status view (#64) polls: up to the 20 most recent
`Commit` rows for the caller's own `installationId`, each with its classification
(`activeTypes`), computed threshold (`finalThreshold`/`finalWindow`), and — if a Standalone
loop ran — the latest `RolloutOutcome` (`rolledBack`/`finalErrorRate`). Always requires
`Authorization: Bearer <installation API key>` — unlike `GET /v1/threshold`'s dual-mode,
there's no legitimate unauthenticated caller for "list everything this installation has
done" (see `src/routes/commits.ts`'s doc comment). `finalThreshold`/`finalWindow`/
`activeTypes`/`rolledBack`/`finalErrorRate` are `null` for a commit that hasn't finished
processing yet (no signal, or no Standalone loop configured) rather than the field being
omitted, so dashboard rendering code doesn't need to distinguish "absent" from "not yet."

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
- `mode` / `adapter` — `mode: "standalone"` with `adapter.kind: "kubernetes"`,
  `"dockerCompose"`, `"pm2"`, `"gitops"`, or `"dockerSwarm"` drives a real rollback adapter
  kickoff from `src/webhookOrchestrator.ts`'s `handleWebhookCommit()` on every webhook.
  `mode: "augment"`
  (or no `mode` at all) just persists and stops — `GET /v1/threshold` serves the result
  separately.

A malformed or schema-invalid `.carf.yml` (bad YAML, unknown field,
invalid enum value) causes the loader (`src/config/carfConfig.ts`) to
throw — this is deliberate "fail closed" behavior, not a bug: an invalid
config must never be silently ignored in favor of defaults.

### Hot-reload

`.carf.yml` is watched for changes at runtime (`src/config/carfConfigWatcher.ts`) — edits
are picked up without restarting the process, debounced (~200ms) since editors often fire
several filesystem events per save. A malformed edit is **not** applied: the reload is
rejected, logged, and the process keeps serving whatever config it already had (same
fail-closed contract as the initial load) — it never silently falls back to built-in
defaults just because a config that used to be valid became invalid mid-edit.
