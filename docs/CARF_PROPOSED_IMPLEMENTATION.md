# CARF — Change-Aware Rollback Framework
## Proposed Implementation, Architecture & Technical Stack

**Based on:** "Change-Aware Automated Rollback Decision Framework for DevOps Pipelines" (co-authored conference paper — Dinesh Korukonda, Tammineni Monika, Jonnalagadda Surya Kiran, Hemachand Pallam)
**Status:** Architecture finalized, pre-implementation
**Repo:** git@github.com:dineshkorukonda/CARF.git

---

## 1. Problem Statement

Automated rollback systems in production today — Argo Rollouts, Flagger, Spinnaker/Kayenta — decide rollback purely from post-deploy metrics (error rate, latency, availability) compared against a **static threshold**. They have no concept of *what actually changed* in the deployment. A one-line copy fix and a database schema migration are watched with identical tolerance and identical observation windows.

This produces two concrete failure modes:
- **False-positive rollbacks** — low-risk changes get rolled back on noise, because the threshold was tuned conservatively enough to catch worst-case scenarios.
- **Slow reaction on real failures** — high-risk changes don't get caught fast enough, because the threshold was loosened to avoid false alarms on everything else.

**Research hypothesis (H1):** Change-type-aware dynamic thresholding reduces false-positive rollback rate compared to static-threshold rollback, at equal or better MTTR (mean time to recovery) on true-positive (real failure) cases.

---

## 2. What CARF Is

CARF is a **change-aware rollback decision protocol** — a core engine plus a thin adapter layer — not a full platform and not a plugin locked to one tool.

Two governing design constraints:
1. **It does not replace existing DevOps tooling.** Where a team already runs Argo Rollouts or Flagger for canary analysis, CARF does not touch Kubernetes or execute anything — it only answers "how strict should you be for this specific commit," via those tools' own webhook interfaces.
2. **It works with any pipeline.** Where no such tool exists (a team running Docker Compose on a VM, or Jenkins with SSH-based deploys), CARF's own lightweight adapters can run the health-check-and-decide loop and execute rollback directly.

**One-line pitch:** *Existing rollback tools decide purely from metrics — they don't know if a diff was a typo fix or a schema migration. CARF reads the actual change, framework-agnostically, and tells any pipeline how strict to be, through a stable API and thin adapters — augmenting mature tools where they exist, and standing in for them where they don't.*

---

## 3. Target Users

Platform/DevOps/SRE teams and small-to-mid engineering orgs with real deploy velocity and on-call burden — spanning two distinct segments this design explicitly supports:
- **K8s-native teams** already running Argo Rollouts or Flagger, Prometheus/Datadog — CARF augments their existing canary analysis.
- **Lighter-weight teams** on Docker Compose/VM or simple CI→SSH pipelines with no canary tooling at all — CARF is their rollback decision layer directly.

---

## 4. System Architecture

```
                              ┌─────────────────────────────────────────┐
                              │                CARF CORE                  │
                              │                                             │
   Trigger Adapters           │   ┌─────────────┐    ┌─────────────────┐  │
   (GitHub Actions,           │──▶│  Classifier   │──▶│  Change Vector    │  │
   GitLab CI, Jenkins,        │   │  Tier 1: path │    │  Store (Postgres) │  │
   generic git webhook)       │   │  Tier 2: tree-│    │  {commit_sha →    │  │
                              │   │  sitter AST   │    │   {type: weight}} │  │
                              │   └─────────────┘    └────────┬─────────┘  │
                              │                                  │            │
                              │                                  ▼            │
                              │                       ┌────────────────────┐ │
                              │                       │  Threshold Engine    │ │
                              │                       │  (formula, §6.2)     │ │
                              │                       └─────────┬──────────┘ │
                              │                                  │            │
                              │        ┌─────────────────────────┼──────────┐│
                              │        │        CARF Native API              ││
                              │        │  GET  /v1/threshold?commit=X        ││
                              │        │  POST /v1/report  (health result)   ││
                              │        └─────────────────────────┬──────────┘│
                              └──────────────────────────────────┼───────────┘
                                                                   │
                    ┌───────────────────────────┬────────────────────────────┐
                    ▼                             ▼                            ▼
        ┌───────────────────────┐   ┌──────────────────────┐   ┌───────────────────────┐
        │ Native Webhook Adapters │   │ Health Source Adapters│   │ Execution Adapters       │
        │ (talk to EXISTING tools)│   │ (feed CARF live data) │   │ (CARF drives rollback,   │
        │                          │   │                        │   │  standalone mode only)   │
        │ - Argo Rollouts webhook  │   │ - Prometheus            │   │                            │
        │   metric provider        │   │ - Datadog               │   │ - kubectl adapter         │
        │ - Flagger webhook metric │   │ - CloudWatch            │   │ - docker-compose restart  │
        │   (Argo/Flagger still    │   │ - plain HTTP healthcheck│   │ - systemd/SSH adapter     │
        │    decide + execute)     │   │                        │   │ - generic shell-hook       │
        └───────────────────────┘   └──────────────────────┘   └───────────────────────┘
```

### 4.1 Two operating modes, one core

| Mode | When used | CARF's role |
|---|---|---|
| **Augment mode** | Argo Rollouts / Flagger already deployed | Purely advisory — answers threshold queries via `GET /v1/threshold`, never executes anything |
| **Standalone mode** | No canary tooling present | Runs its own health-check loop, calls an execution adapter to roll back directly |

Same classifier, same threshold formula, same evaluation harness in both modes — only the last hop (who executes) differs.

### 4.2 Data flow

1. PR merges → a trigger adapter (e.g. GitHub Actions) sends the commit's diff to CARF.
2. **Tier 1 Classifier** tags every changed file by path/manifest type (infra, dependency, config, code).
3. **Tier 2 Classifier** runs `tree-sitter`-based structural diffing on files tagged "code," producing a complexity score.
4. Output is a **change vector** — a weighted map across types, not a single label — persisted to Postgres.
5. **Threshold Engine** computes a dynamic error/latency threshold and observation window from the change vector.
6. Depending on mode:
   - *Augment:* Argo Rollouts/Flagger call `GET /v1/threshold?commit=X` mid-canary and apply it themselves.
   - *Standalone:* CARF's own decision loop polls a health adapter, compares against the computed threshold, and calls an execution adapter if violated.
7. All outcomes are logged to the Change Vector Store for later evaluation.

---

## 5. Feature List

### 5.1 Tier 1 Classifier — path/manifest-based
Classifies changed files by artifact type, not language — framework-agnostic by construction, zero parsing overhead.

| File pattern | Classification |
|---|---|
| `Dockerfile`, `docker-compose.yml` | infra/container |
| `k8s/**/*.yaml`, `helm/**` | infra/orchestration |
| `*.tf` | infra/provisioning |
| `ansible/**`, `playbook.yml` | infra/config-management |
| `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` | dependency |
| `migrations/**` | data/schema |
| everything else | code (routed to Tier 2) |

### 5.2 Tier 2 Classifier — structural diff via tree-sitter
Parses "code" bucket changes using `tree-sitter` (multi-language grammar support: Python, Go, JS/TS, Elixir, Rust, Java) to compute a complexity score from functions touched, signature changes, and nesting depth delta. Chosen over Babel specifically because Babel is JS/TS-only — tree-sitter provides one uniform parsing API regardless of source language.

### 5.3 Change Vector Store
Every commit's classification — `{commit_sha, change_vector: {type: weight}, complexity_score}` — persisted to Postgres, queryable by the Threshold Engine and by the evaluation harness.

### 5.4 Threshold Engine
Computes dynamic threshold + observation window from a change vector using a documented, versioned formula (§6.2) — not an implicit rule. This is the component the original paper described in words but never specified algorithmically.

### 5.5 CARF Native API
- `GET /v1/threshold?commit=<sha>` → returns threshold, window, and the underlying change vector.
- `POST /v1/report` → accepts a live health reading, returns `continue` or `rollback` with a reason.

This is the entire integration surface. Any pipeline can adopt CARF by implementing just one of: a trigger adapter, a health adapter, or by simply querying `/v1/threshold`.

### 5.6 Adapters
- **Native webhook adapters** — Argo Rollouts `AnalysisTemplate` webhook provider, Flagger webhook metric.
- **Health source adapters** — Prometheus, Datadog, CloudWatch, plain HTTP healthcheck.
- **Execution adapters** (standalone mode only) — kubectl, docker-compose restart, systemd/SSH, generic shell-hook (runs any user-provided rollback script — trivially covers targets not explicitly supported).

### 5.7 Custom Sensitivity Rules API
CRUD endpoints letting teams override computed classification/thresholds — e.g. "anything under `payment/` is always high-sensitivity." User rules take precedence over computed defaults.

### 5.8 Evaluation Harness (research-critical component, not optional)
A synthetic deployment injector plus A/B comparison framework, built as a first-class part of CARF rather than bolted on afterward — see §7.

### Explicitly out of scope (v1)
- Adaptive/learned thresholds (thresholds are static/configured — no "self-healing" claim).
- Business KPI integration (conversion rate, revenue) — infra/app-health layer only.
- Coordination with in-flight feature flags or overlapping canary states — stated limitation, not silently ignored.

---

## 6. Algorithm

### 6.1 Classification (produces a vector, not a label)

```
Tier 1 — path-based:
  for file in diff.changed_files:
      type = match_path_pattern(file)
      tally[type] += 1

Tier 2 — structural (only for files tagged "code"):
  for file in tally["code"].files:
      ast_delta = tree_sitter_diff(file.before, file.after)
      complexity += weight(functions_touched, signature_changes, nesting_delta)

Output:
  change_vector = normalize({
      "infra": tally["infra"] / total_files,
      "dependency": tally["dependency"] / total_files,
      "config": tally["config"] / total_files,
      "code": tally["code"] / total_files,
      "code_complexity": normalized_complexity_score   # 0–1
  })
```

This handles mixed changes (e.g. a PR touching both `k8s/deploy.yaml` and `src/handler.py`) by producing a weighted vector — `{infra: 0.4, code: 0.6, code_complexity: 0.3}` — instead of forcing a single category.

### 6.2 Threshold Engine (the formula the original paper lacked)

```
base_threshold[type] / base_window[type], configured per type, e.g.:
   infra:      error_rate ≤ 1%,  window = 2 min
   dependency: error_rate ≤ 3%,  window = 5 min
   config:     error_rate ≤ 2%,  window = 3 min
   code:       error_rate ≤ 5%,  window = 10 min

for each type with weight > 0 in change_vector:
    contribution[type]        = base_threshold[type] × (1 − decay × change_vector[type])
    contribution_window[type] = base_window[type]    × (1 − decay × change_vector[type])

final_threshold = min(contribution[type] for type in active_types)   # strictest wins
final_window    = min(contribution_window[type] for type in active_types)

if change_vector["code_complexity"] exists:
    final_threshold *= (1 − complexity_decay × change_vector["code_complexity"])
```

`decay` and `complexity_decay` are tunable constants, checked into version-controlled config, and reported as part of the evaluation results (this becomes a results table in the paper).

### 6.3 Decision Loop (standalone mode only)

```
on deploy_triggered(commit):
    vector = classify(commit)
    store(commit, vector)
    threshold, window = compute(vector)
    start_timer(window)
    while timer_active:
        health = health_adapter.check()
        report(commit, health)
        if health.error_rate > threshold:
            execution_adapter.rollback(commit)
            log(commit, "rolled_back", reason="threshold_violation")
            return
    log(commit, "stable")
```

In augment mode, this loop is owned by Argo Rollouts/Flagger — CARF only answers their threshold query.

---

## 7. Evaluation Harness (proves H1)

```
Synthetic Deployment Injector:
  - generates N deployments against a demo target app
  - half labeled "risky" ground truth (schema migration, resource limit change, bad config)
  - half labeled "safe" ground truth (copy change, log level, comment-only)

Two conditions, identical deployment set:
  A. Baseline — static threshold (mirrors default Argo/Flagger behavior: one threshold for all)
  B. CARF — dynamic threshold via change_vector

Recorded per run:
  - predicted rollback (yes/no)
  - ground-truth label (should have rolled back?)
  - time from deploy to rollback decision (MTTR proxy)

Metrics:
  - false_positive_rate = rollbacks on "safe" deployments / total safe
  - true_positive_MTTR  = avg time-to-rollback on "risky" deployments
  - precision / recall on rollback decisions

A vs B comparison → primary Results table/figure for the research paper.
```

Built early in the implementation sequence (see §9) — not an afterthought — since it is both the strongest resume/paper artifact and the direct fix for the original paper's "no experimental section" critique.

---

## 8. Proposed Technical Stack

### Core (`core-api/`)
- **Language:** TypeScript (Node.js)
- **Framework:** Fastify
- **Database:** PostgreSQL — change vector store, custom sensitivity rules, evaluation run logs
- **ORM:** Prisma
- **Diff/AST parsing:** `tree-sitter` + per-language grammar packages (`tree-sitter-python`, `tree-sitter-go`, `tree-sitter-javascript`, `tree-sitter-typescript`, etc.)
- **Git diff parsing:** `simple-git` or direct `git diff` shell-out from CI webhook payloads

### Adapters
- **Native webhook adapters:** Argo Rollouts `AnalysisTemplate` webhook provider spec, Flagger webhook metric spec
- **Health source adapters:** Prometheus (PromQL client), Datadog API client, CloudWatch client, generic HTTP healthcheck poller
- **Execution adapters:** Kubernetes client (`kubectl rollout undo` equivalent via API), Docker Compose CLI wrapper, SSH-based systemd restart, generic shell-hook runner (executes a user-provided script — universal fallback)
- **Trigger adapters:** GitHub Actions webhook receiver, GitLab CI webhook receiver, generic Git webhook receiver

### Evaluation Harness
- **Synthetic injector:** Node.js/TypeScript script generating labeled synthetic commits against `demo-target-app`
- **Demo target app:** minimal app deployable via both Argo Rollouts (kind/minikube) and Docker Compose, to prove cross-pipeline consistency
- **Results storage/analysis:** Postgres tables for run logs; Python (pandas/matplotlib) or a small TypeScript script for aggregating metrics and generating the comparison charts/tables for the paper

### Infra / Deployment
- **Containerization:** Docker
- **Local orchestration:** docker-compose (CARF core + Postgres, for local dev and for standalone-mode testing)
- **K8s testing environment:** kind or minikube, with Argo Rollouts installed, for augment-mode testing
- **CI:** GitHub Actions — lint, unit tests, and an integration test job that runs the eval harness against both modes

### Frontend / Dashboard (optional, later phase)
- **Framework:** Next.js
- **Purpose:** view change vectors, deployment/eval history, configure custom sensitivity rules
- Not required for the core research contribution — sequenced after core + eval harness are proven.

---

## 9. Build Order

1. **Tier 1 Classifier** — path/manifest rules engine, outputs a vector. No dependencies, fastest demoable output.
2. **Threshold Engine** — implement the formula (§6.2) against a checked-in config table.
3. **CARF Native API** — `GET /v1/threshold`, `POST /v1/report`, backed by the Change Vector Store (Postgres/Prisma).
4. **Evaluation Harness + synthetic injector + baseline mode** — moved up deliberately; get a first A/B data point using only the Tier 1 classifier before adding complexity.
5. **First H1 test run** — Tier 1 only, establishes a baseline result even before Tier 2 exists.
6. **Generic shell-hook execution adapter + plain HTTP health adapter** — proves standalone mode works on the simplest possible target (no k8s required).
7. **Argo Rollouts webhook adapter** — proves augment mode against a real canary tool.
8. **Tier 2 Classifier (tree-sitter)** — add structural complexity scoring.
9. **Re-run evaluation harness** — show the Tier 1+2 combination improves on Tier-1-only results; this becomes the paper's core comparison.
10. **Additional adapters** (Datadog, CloudWatch, Flagger, kubectl, docker-compose, SSH) — breadth, after the core claim is proven.
11. **Custom Sensitivity Rules API** — CRUD + precedence logic.
12. **(Optional) Next.js dashboard.**

---

## 10. Link to the Conference Paper — Gaps Closed

| Paper critique | Resolved by |
|---|---|
| No concrete threshold algorithm | §6.2 — documented, versioned formula with configurable constants |
| Rule-based classification too simplistic for mixed changes | §6.1 — classifier outputs a weighted vector, not a single label |
| No experimental/evaluation section | §7 — evaluation harness with synthetic injector, A/B baseline comparison, precision/recall/MTTR metrics |
| Assumed Kubernetes/GitOps specifically | §4.1 — augment + standalone modes via adapter layer; not tied to any one orchestrator |
| "Self-healing" overclaimed | Renamed internally to "decision engine" — explicitly reactive and statically configured in v1, not adaptive |
| No stated system boundaries | §5, "Explicitly out of scope" — infra/app-health layer only, business KPIs and canary-state coordination named as future work |
| No survey methodology | (Paper-side fix, not framework-side) — add search strategy section: databases, terms, inclusion/exclusion criteria |

**Updated hypothesis for the eventual full research paper:**
> Change-type-aware dynamic thresholding, computed via structural diff analysis, reduces false-positive rollback rate compared to static-threshold rollback strategies, without degrading MTTR on genuine failures — validated across both Kubernetes/canary-tool-integrated and lightweight standalone deployment pipelines.
