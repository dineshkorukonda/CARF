# CARF — Change-Aware Rollback Framework

**Status:** Architecture Finalized & Technical Specifications Published  
**Repo:** [git@github.com:dineshkorukonda/CARF.git](https://github.com/dineshkorukonda/CARF)  
**Based on:** *"Change-Aware Automated Rollback Decision Framework for DevOps Pipelines"* (co-authored research paper — Dinesh Korukonda, Tammineni Monika, Jonnalagadda Surya Kiran, Hemachand Pallam)

---

## 🌐 Research & Technical Architecture Portal

Visit our interactive web application for the full technical specifications, AST parsing algorithms, change vector formulas, interactive decision pipeline simulator, and conference paper overview:

👉 **[Launch CARF Web Portal & Interactive Simulator](https://github.com/dineshkorukonda/CARF/tree/main/website-app)**

---

## 1. What CARF Is

CARF is a **framework-agnostic decision layer and sidecar protocol** that plugs directly into progressive delivery tools like Argo Rollouts or Flagger, as well as lightweight standalone deployment scripts.

**Existing progressive delivery tools decide rollback purely from runtime metrics — they don't know if a diff was a typo fix or a database schema migration. CARF inspects the actual change (via Tier 1 path classification & Tier 2 Tree-Sitter AST parsing) and tells pipelines how strict to be through stable webhook interfaces.**

```
+------------------+     +------------------------+     +-------------------+
|  Git PR / Commit | --> |  CARF Tier 1 & Tier 2  | --> | Postgres Vector   |
|  Webhook Trigger |     |  Tree-Sitter Classifier|     | Change Store      |
+------------------+     +------------------------+     +-------------------+
                                                                  |
                                                                  v
+------------------+     +------------------------+     +-------------------+
| Argo Rollouts /  | <-- | Dynamic Threshold      | <-- | CARF Threshold    |
| Flagger Rollback |     | Webhook API Endpoint   |     | Decay Engine      |
+------------------+     +------------------------+     +-------------------+
```

---

## 2. Key Technical Features

- **Tier 1 Classifier:** Framework-agnostic path pattern matching (e.g. `Dockerfile` $\rightarrow$ `infra/container`, `package.json` $\rightarrow$ `dependency`).
- **Tier 2 Classifier:** Multi-language `tree-sitter` AST parsing (Go, Python, TypeScript, Rust, Java) to compute structural code complexity scores.
- **Change Vector Store:** Persists normalized `{infra, config, dependency, code, code_complexity}` commit vectors in PostgreSQL.
- **Dynamic Threshold Webhook API:** Exposes mid-canary dynamic error tolerance limits (`GET /v1/threshold?commit=SHA`) queried by Argo Rollouts `AnalysisTemplate` or Flagger metrics.
- **Interactive Simulator Web App (`website-app/`):** Next.js web portal with interactive pipeline flow simulator and research paper portal built in Thinking Machines design style.

---

## 3. Getting Started & Running the Web App

### Run Web Portal
```bash
cd website-app
npm run dev
```
Open `http://localhost:3000` to view the interactive simulator, proposed architecture specs, and conference paper page.

---

## 4. Documentation & Specifications

Detailed technical specifications, math formulas, and build order roadmap can be found in [docs/CARF_PROPOSED_IMPLEMENTATION.md](docs/CARF_PROPOSED_IMPLEMENTATION.md).

---

## 5. Implementation Roadmap & Monorepo

CARF is implemented across three structured phases within the monorepo (`core-api`, `packages/github-action`, and `demo-target-app`): **Phase 1** establishes the two-tier classification engine (path pattern matching + Tree-sitter AST structural delta parsing), **Phase 2** delivers the configurable threshold decay calculation engine and Postgres/Prisma persistence layer, and **Phase 3** provides Augment mode Fastify webhooks, Standalone health-checking execution adapters (Docker Compose and kubectl), and the synthetic deployment evaluation harness.
