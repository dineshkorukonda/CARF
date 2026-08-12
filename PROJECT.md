# CARF — Change-Aware Rollback Framework

**Status:** Architecture finalized, pre-implementation
**Repo:** git@github.com:dineshkorukonda/CARF.git
**Based on:** "Change-Aware Automated Rollback Decision Framework for DevOps Pipelines" (co-authored research paper — Dinesh Korukonda, Tammineni Monika, Jonnalagadda Surya Kiran, Hemachand Pallam)

---

## 1. Problem Statement

Automated rollback systems today (Argo Rollouts, Flagger, Spinnaker/Kayenta) make rollback decisions purely from post-deploy metrics — error rate, latency, availability — compared against a static threshold. They treat every deployment identically: a one-line copy change and a database schema migration get watched with the same tolerance and the same time window.

This causes two failure modes in practice:
- **False alarms** — low-risk changes trigger rollbacks on noise because the threshold was tuned for worst-case scenarios.
- **Slow reactions on real failures** — high-risk changes don't get rolled back fast enough because the threshold was tuned to avoid false alarms on everything else.

The paper's core claim: rollback strictness should be a function of *what actually changed*, not just what the metrics say afterward. Classify the change, then apply change-type-specific thresholds.

---

## 2. What CARF Is (Revised Scope)

CARF is **not** a full rollback platform. It does not touch Kubernetes, does not generate git revert commits, and does not run its own canary analysis loop. Mature, production-grade tools already do that correctly (Argo Rollouts, Flagger).

CARF is a **decision layer / sidecar** that plugs into those tools. It reads the actual diff behind a deployment, scores how risky that specific change is, and exposes that score as a dynamic threshold via a webhook — which Argo Rollouts or Flagger call mid-canary to decide how strict to be.

**One-line pitch:** *Argo Rollouts and Flagger decide rollback purely from metrics — they don't know if a diff was a typo fix or a schema migration. CARF reads the actual change, framework-agnostically, and tells them how strict to be, through their existing webhook interfaces.*

**Why this scope change matters (for mentor/panel questions):**
- Reimplementing k8s rollback execution or GitOps revert-commit generation duplicates mature OSS with no differentiation.
- The genuinely novel contribution — diff-aware, change-type-driven threshold scoring — was previously buried inside a full pipeline. Narrowing the scope isolates and sharpens that contribution.
- Integrating with real DevOps tooling (Docker, Kubernetes, Ansible, Terraform, Argo, Flagger, Prometheus, Datadog) instead of rebuilding pieces of it is a stronger devops-project argument than a standalone pipeline.

---

## 3. Target Users

Platform/DevOps/SRE teams already running:
- Kubernetes + GitOps (ArgoCD or Flux)
- Argo Rollouts or Flagger for progressive delivery
- Prometheus or Datadog for telemetry

Realistically mid-size engineering orgs — deploy velocity and on-call pain high enough to need this, not yet at a scale where they've built an in-house equivalent. Not a fit for solo devs (no k8s footprint) or large enterprises already deep in Spinnaker/custom tooling.

---

## 4. Features

### 4.1 Tier 1 Classifier — path/manifest-based
Classifies a changed file by *what kind of artifact* it is, not its language. Zero parsing required, framework-agnostic by construction.

| File pattern | Classification |
|---|---|
| `Dockerfile`, `docker-compose.yml` | infra/container |
| `k8s/**/*.yaml`, `helm/**` | infra/orchestration |
| `*.tf` | infra/provisioning |
| `ansible/**`, `playbook.yml` | infra/config-management |
| `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` | dependency |
| `migrations/**` | data/schema |
| everything else | code (fallback → Tier 2) |

### 4.2 Tier 2 Classifier — structural diff via tree-sitter
For changes bucketed as "code," parses the diff using `tree-sitter` (multi-language grammar support — Python, Go, JS/TS, Elixir, Rust, Java, etc.) to compute a complexity score based on:
- number of functions/methods touched
- function signature changes
- nesting depth delta
- lines changed weighted by AST node type (not raw line count)

Chosen over Babel specifically because Babel is JS/TS-only; tree-sitter gives a uniform parsing API across languages, which is what makes the classifier actually framework-agnostic rather than agnostic in name only.

### 4.3 Change Vector storage
Every classified commit — `{commit_sha, change_type, complexity_score, files_touched}` — is persisted to Postgres so it can be looked up later during canary analysis without recomputing.

### 4.4 Dynamic Threshold Webhook API
The core integration point. An endpoint Argo Rollouts (`AnalysisTemplate` webhook provider) or Flagger (webhook metric) calls mid-canary: *"what's my error/latency tolerance and observation window for commit X?"* CARF responds based on the stored change vector — e.g. tight window + low error tolerance for high-complexity infra changes, wider/more lenient for low-risk code tweaks.

### 4.5 Telemetry-aware scoring (Prometheus / Datadog)
CARF can optionally pull current baseline health data (via Prometheus/Datadog adapters) to sanity-check or adjust its threshold output. It does not independently decide or execute rollback — that loop stays entirely inside Argo Rollouts / Flagger.

### 4.6 Custom Sensitivity Rules API
CRUD endpoints letting teams override default classification/scoring — e.g. "anything under `payment/` is always high-sensitivity regardless of computed complexity." User-defined rules take precedence over computed defaults.

### Explicitly out of scope
- Direct Kubernetes rollback execution (`kubectl rollout undo`) — owned by Argo Rollouts / Flagger.
- Direct GitOps revert-commit generation — owned by Argo Rollouts / Flagger.
- Independent canary analysis / metric-based pass-fail decisions — owned by Argo Rollouts / Flagger.

---

## 5. Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│   CI/PR      │────▶│  CARF Classifier  │────▶│  Postgres                │
│  (webhook)   │     │  Tier 1 (paths)   │     │  commit_sha → change_    │
│              │     │  Tier 2 (tree-    │     │  vector (type, score)   │
│              │     │  sitter, code only)│     │                          │
└─────────────┘     └──────────────────┘     └───────────┬─────────────┘
                                                            │
                                                            ▼
                                              ┌──────────────────────────┐
                                              │  CARF Webhook Endpoint    │
                                              │  "threshold for commit X?"│
                                              │  reads change_vector +    │
                                              │  optional live telemetry  │
                                              └───────────┬──────────────┘
                                                            │
                          ┌──────────────────────────────────┼──────────────────────────────────┐
                          ▼                                                                       ▼
                ┌──────────────────────┐                                              ┌──────────────────────┐
                │  Argo Rollouts        │                                              │  Flagger              │
                │  AnalysisTemplate     │ ◀── calls CARF as webhook metric provider    │  webhook metric        │
                │  runs canary, reads   │                                              │  runs canary, reads    │
                │  Prometheus/Datadog,  │                                              │  Prometheus/Datadog,   │
                │  DECIDES + EXECUTES   │                                              │  DECIDES + EXECUTES    │
                │  rollback itself      │                                              │  rollback itself       │
                └──────────────────────┘                                              └──────────────────────┘
```

**Flow:**
1. PR merges → CI fires a webhook to CARF with the diff/commit metadata.
2. Tier 1 classifies by file path; Tier 2 runs tree-sitter complexity scoring if the change falls in the "code" bucket.
3. Change vector is persisted to Postgres.
4. Deploy triggers a canary rollout in Argo Rollouts or Flagger.
5. Mid-canary, the analysis tool calls CARF's webhook endpoint asking for the threshold/window for that commit.
6. CARF returns a dynamic threshold based on the stored vector (and optionally live telemetry).
7. Argo Rollouts / Flagger runs its own metric checks against that threshold and decides/executes rollback itself.

---

## 6. Tech Stack

### Backend (`core-api/`)
- **Language:** TypeScript (Node.js) — matches existing stack familiarity (Fastify used in VersionGate)
- **Framework:** Fastify
- **Database:** PostgreSQL (`carf_db`) — change vectors, custom sensitivity rules
- **ORM:** Prisma
- **Diff/AST parsing:** `tree-sitter` with per-language grammar packages (`tree-sitter-python`, `tree-sitter-go`, `tree-sitter-javascript`, `tree-sitter-typescript`, etc.)
- **Git diff parsing:** `simple-git` or direct `git diff` shell-out for CI webhook payloads

### Integrations
- **Argo Rollouts** — webhook-based `AnalysisTemplate` metric provider
- **Flagger** — webhook metric provider
- **Prometheus** — PromQL client for optional telemetry-aware scoring
- **Datadog** — API client, same purpose
- **Docker** — Dockerfile/compose diff detection (Tier 1), optional base-image-version-vs-layer-change distinction
- **Kubernetes** — read-only awareness of manifest changes (Tier 1 classification only, no execution)
- **Ansible / Terraform** — Tier 1 path classification for infra-as-code changes

### Infra / Deployment
- **Containerization:** Docker
- **Local dev orchestration:** docker-compose (CARF API + Postgres)
- **CI:** GitHub Actions (lint, test, and eventually self-hosted-runner integration test against a demo Argo Rollouts setup)
- **Demo/testing target:** a small sample app (`demo-target-app/`) deployed via Argo Rollouts in a local kind/minikube cluster, used to validate that CARF's threshold responses actually change canary behavior

### Frontend / Dashboard (optional, later phase)
- **Framework:** Next.js
- **Purpose:** view change vectors, deployment history, configure custom sensitivity rules (UI over the CRUD API in 4.6)
- Not required for the core research contribution — build after `core-api/` and the Argo/Flagger integration are proven.

---

## 7. Build Order

1. **Tier 1 Classifier** — path/manifest rules engine. No dependencies, framework-agnostic by construction, fastest path to a demoable output. *(Agreed starting point.)*
2. **Change Vector storage** — Postgres schema + Prisma models, wire Tier 1 output into it.
3. **Dynamic Threshold Webhook endpoint** — stub that reads a change vector and returns a threshold payload shaped correctly for Argo Rollouts' `AnalysisTemplate` webhook provider spec.
4. **Argo Rollouts integration proof-of-concept** — local kind cluster, `demo-target-app`, one `AnalysisTemplate` pointed at CARF's webhook, prove a real canary run reacts differently to a high-vs-low complexity change.
5. **Tier 2 Classifier** — tree-sitter integration, complexity scoring for the "code" bucket.
6. **Telemetry-aware scoring** — Prometheus adapter first (open-source, no API key friction), Datadog second.
7. **Custom Sensitivity Rules API** — CRUD endpoints, precedence logic over computed defaults.
8. **(Optional) Next.js dashboard** — visualize change vectors and deployment history.

---

## 8. Link to the Research Paper

The paper proposes a 4-phase conceptual pipeline: Change Classifier → Metrics Collector → Decision Engine → Rollback Executor, aimed at reducing MTTR and cutting unnecessary rollbacks by applying change-type-specific metric thresholds.

CARF-as-implemented maps onto that pipeline but reassigns ownership of the last two phases to existing production tools rather than building them from scratch:

| Paper phase | CARF implementation |
|---|---|
| Change Classifier | Tier 1 (path-based) + Tier 2 (tree-sitter) — §4.1, §4.2 |
| Metrics Collector | Prometheus/Datadog adapters, used to *inform* thresholds, not decide independently — §4.5 |
| Decision Engine | Dynamic Threshold Webhook — CARF computes the threshold; Argo Rollouts/Flagger apply it and make the pass/fail call — §4.4 |
| Rollback Executor | Delegated entirely to Argo Rollouts / Flagger — explicitly out of scope for CARF |

This is a defensible, honest framing for a paper-to-project writeup: the research contribution (change-type-aware dynamic thresholding) is fully implemented; the execution mechanics are delegated to tools built for that exact purpose, which is standard and expected practice in real DevOps engineering rather than a shortcut.

---

## 9. Open Questions / Not Yet Decided

- Multi-category changes (a PR touching both code and infra) — does the classifier output a single dominant type or a weighted vector? Affects the threshold webhook's response shape.
- Whether Tier 2 complexity scoring needs a normalized 0–1 score or a raw weighted count — affects how thresholds are tuned per team.
- Auth model for the webhook endpoint (Argo/Flagger calling CARF) — likely a shared secret / HMAC signature, consistent with the pattern already used in VersionGate's GitHub App OAuth relay.
