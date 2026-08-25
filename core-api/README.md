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
- `src/adapters/dockerSwarm.ts` — `DockerSwarmAdapter`, shells out to `docker service`.
  `checkHealth` reads `docker service ps <target> --filter desired-state=running --format
  json` and derives `errorRate` from the fraction of tasks whose `CurrentState` doesn't
  start with `"Running"`. `rollback` runs `docker service update --rollback <target>` —
  Swarm tracks the previous spec itself, like `kubectl rollout undo`, so no explicit
  previous-version bookkeeping is needed (unlike Docker Compose's gap, see issue #50).

All three exec-based adapters take an injectable exec function (defaulting to Node's real
`child_process.exec`, promisified) so unit tests never shell out for real — see
`test/adapters/dockerCompose.test.ts`, `test/adapters/kubectl.test.ts`, and
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
