# CARF — Change-Aware Rollback Framework

**Status:** Architecture finalized, pre-implementation  
**Repo:** git@github.com:dineshkorukonda/CARF.git  
**Based on:** "Change-Aware Automated Rollback Decision Framework for DevOps Pipelines" (co-authored research paper — Dinesh Korukonda, Tammineni Monika, Jonnalagadda Surya Kiran, Hemachand Pallam)

---

## 1. What CARF Is

CARF is a **decision layer / sidecar** that plugs into progressive delivery tools like Argo Rollouts or Flagger. 

**Argo Rollouts and Flagger decide rollback purely from metrics — they don't know if a diff was a typo fix or a schema migration. CARF reads the actual change, framework-agnostically, and tells them how strict to be, through their existing webhook interfaces.**

CARF is **not** a full rollback platform. It does not touch Kubernetes, does not generate git revert commits, and does not run its own canary analysis loop. Mature, production-grade tools already do that correctly.

## 2. Features

- **Tier 1 Classifier:** Classifies a changed file by what kind of artifact it is (e.g., `Dockerfile` -> `infra/container`), framework-agnostic by construction.
- **Tier 2 Classifier:** Uses `tree-sitter` for structural diff parsing to compute a complexity score for code changes.
- **Change Vector Storage:** Persists classified commits to Postgres for fast lookups.
- **Dynamic Threshold Webhook API:** Exposes a dynamic threshold (based on the change score) via a webhook that Argo Rollouts or Flagger calls mid-canary.
- **Custom Sensitivity Rules API:** Allows teams to override default classification/scoring (e.g., "anything under `payment/` is always high-sensitivity").

## 3. Architecture Flow

```mermaid
flowchart TD
    A[CI/PR webhook] --> B[CARF Classifier\nTier 1 & Tier 2]
    B -->|Persists vector| C[(Postgres)]
    
    C --> D[CARF Webhook Endpoint]
    
    E[Argo Rollouts / Flagger\nAnalysisTemplate] -->|Calls CARF| D
    D -->|Returns dynamic threshold| E
    
    E -->|Reads Prometheus/Datadog| F{DECIDES + EXECUTES\nrollback itself}
```

## 4. Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL server

---

### Database Setup & Migrations

1. Ensure PostgreSQL is running locally and create the `carf_db` database:
   ```bash
   createdb carf_db
   ```
2. Configure environment variables in `core-api/.env`:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carf_db
   PORT=3000
   ```
3. Run database migrations:
   ```bash
   cd core-api
   npm run migrate
   ```

---

### Running the Core API Server

Start the CARF Core API backend service:
```bash
cd core-api
npm start
```
The server will be running on `http://localhost:3000`.

---

### Running Unit Tests

Run the pure unit test suite:
```bash
cd core-api
npm test
```

---

### Demo Target App

The `demo-target-app/` contains a small sample app used to validate that CARF's threshold responses actually change canary behavior when deployed via Argo Rollouts in a local cluster.
