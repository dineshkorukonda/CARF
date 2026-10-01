# Paper vs implementation (source of truth)

The conference paper is **not stored in this repository**. When paper copy and
code disagree, **this file plus `core-api` defaults win**. Do not change
`DEFAULT_ENGINE_CONFIG` to match stale paper tables.

Verified against `main` during Phase 1 (Truth & Correctness).

## Change vector includes `data` (#145)

Paper §IV.D writes `V = (v_infra, v_dependency, v_config, v_code, C_code)`
(four types). Implemented `ChangeVector` is five types plus complexity:

```ts
{ infra, dependency, config, code, data, code_complexity }
```

`data` is migrations/schema (see `core-api/src/classifier/tier1.ts`). The
paper's own results table already has a "Code + Data" row — the formula should
match.

Threshold decay iterates `[infra, dependency, config, code, data]` in
`core-api/src/threshold/engine.ts`.

## Production threshold table (#144)

Do **not** change these values to match the paper. Correct the paper (and any
in-repo copy) to this table from
`core-api/src/threshold/versionedEngineConfig.ts` (`ENGINE_CONFIG_V1`):

| Type | Base threshold | Base window |
|---|---|---|
| infra | 1% (`0.01`) | 60s |
| data | 1% (`0.01`) | 600s |
| dependency | 3% (`0.03`) | 180s |
| config | 5% (`0.05`) | 300s |
| code | 8% (`0.08`) | 900s |

Decay: `0.5`. Complexity decay: `0.3`.

Paper §IV.E (infra 1%/2min, config 2%/3min, dependency 3%/5min, code 5%/10min)
is stale and omits `data`.

## Custom Tier 1 rules are implemented (#148)

Paper §IV.B: custom rules classify first, then built-in rules. **Confirmed.**

| Layer | Behavior |
|---|---|
| Schema | `.carf.yml` `classification.rules[]` (`type` + `patterns`) |
| Classifier | `classifyTier1(paths, userRules)` prepends user rules; first match wins |
| Pipeline | `processCommit(..., { classificationRules })` |
| Webhook | `webhookOrchestrator` passes `activeCarfConfig?.classification?.rules ?? []` |
| Evaluation | `runHarness` threads the same option |

Example (`core-api/.carf.example.yml`):

```yaml
classification:
  rules:
    - type: infra
      patterns:
        - "deploy/**/*.yaml"
```

Tests: `core-api/test/classifier/tier1.test.ts`, `vector.test.ts`,
`pipeline.test.ts`, `evaluation/harness.test.ts`.

## `/dashboard/verify` is not paper evidence (#154)

The page **computes** Condition A/B metrics from synthetic templates. It does
**not** hardcode a scorecard, and it also does **not** call the production
classifier or `computeThreshold()`. MTTR is a sampled delay. Do not cite those
numbers in the paper. See dashboard copy and `dashboard/src/lib/evalHarness.ts`.

## Still paper-only / later phases

| Issue | Status |
|---|---|
| #143 Augment `GET /v1/augment/threshold` | Implemented — read-only `{ threshold, window, changeVector }` |
| #149 Slack/Email/Dashboard alerts on rollback | Phase 2 — not implemented |
| #146 Feedback loop from `RolloutOutcome` | Phase 3 — persistence exists, calibration does not |
| #139–#142 K8s / Compose / Swarm / GitOps as standalone adapters | Phase 3 — deprecated; PM2 is the validated standalone adapter |
