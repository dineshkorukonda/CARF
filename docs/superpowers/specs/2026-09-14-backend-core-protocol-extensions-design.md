# Backend Core Protocol Extensions Design Specification

**Status:** Proposed & In Review  
**Sub-Project:** 1 of 5 (CARF Enhancement Roadmap)  
**Package:** `core-api`

---

## 1. Problem Statement

CARF's core decision engine was specified in `docs/CARF_PROPOSED_IMPLEMENTATION.md` with a dual API: `GET /v1/threshold` (Augment mode read) and `POST /v1/report` (health reading evaluation). While `GET /v1/threshold` and local CLI-based polling loops (Docker Compose, Kubectl, PM2) are implemented, three key backend gaps remain:

1. **Missing `POST /v1/report` Push Interface:** External APM tools (Prometheus Alertmanager, Datadog Webhooks, or custom CI shell scripts) cannot push health metric readings to CARF to get an instantaneous rollback verdict.
2. **Test File Churn Sensitivity Skew:** `classifier/tier2.ts` parses all `*.ts`, `*.py`, `*.go` files indiscriminately. Large additions of unit tests (`*.test.ts`, `tests/`) inflate the AST cyclomatic complexity delta, artificially shrinking the production error budget for benign test refactors.
3. **Lack of Prometheus APM Adapter:** Standalone mode adapters only inspect container runtime status (`docker compose ps`, `kubectl rollout`), lacking native integration with Prometheus PromQL metric queries.
4. **Operational Telemetry:** `core-api` lacks a Prometheus `/metrics` exposition endpoint to observe CARF's own throughput, decisions, and AST latency.

---

## 2. Scope & Interfaces

### In Scope:
- **`POST /v1/report` Route (`core-api/src/routes/report.ts`):**
  - Accepts `{ commit: string, errorRate: number, durationMs?: number }`.
  - Authenticated via optional/required `Authorization: Bearer <installationApiKey>` (mirroring `GET /v1/threshold`).
  - Evaluates `errorRate >= threshold.finalThreshold`.
  - Returns 200 `{ action: "continue" | "rollback", reason: string, finalThreshold: number, currentErrorRate: number, finalWindow: number }`.
  - Persists `RolloutOutcome` telemetry row upon verdict.
- **Test Churn Classification & Discounting:**
  - In `classifier/tier1.ts`, detect test file patterns (`**/*.test.*`, `**/*.spec.*`, `**/tests/**`, `**/__tests__/**`, `**/*_test.go`, `**/*_test.py`).
  - Distinguish test files from production code; apply a `0.1x` dampener on test AST complexity in `classifier/codeComplexityScorer.ts` so test expansion does not penalize production error tolerance.
- **`PrometheusAdapter` (`core-api/src/adapters/prometheus.ts`):**
  - Implements `RollbackAdapter` interface (`checkHealth`, `rollback`).
  - Queries Prometheus API (`/api/v1/query?query=...`) using native `fetch`.
  - Executes rollback via configurable command or shell-hook when error threshold is breached.
- **`GET /metrics` Exporter (`core-api/src/routes/metrics.ts`):**
  - Standard Prometheus text format.
  - Exposes counters for analyzed commits, health reports, rollbacks, and AST parsing durations.

### Out of Scope:
- Modifying database schemas (existing Prisma models `Commit`, `Threshold`, `RolloutOutcome`, `InstallationApiKey` cover all data needs).
- UI dashboard changes (handled in Sub-Projects 2, 3, and 5).

---

## 3. Detailed Architecture & Design

### 3.1 `POST /v1/report` Route Design

#### Schema:
```json
{
  "type": "object",
  "required": ["commit", "errorRate"],
  "properties": {
    "commit": { "type": "string" },
    "errorRate": { "type": "number", "minimum": 0 },
    "durationMs": { "type": "number", "minimum": 0 }
  }
}
```

#### Seam & Prisma Access:
```typescript
export interface ReportRoutePrismaClient extends InstallationAuthPrismaClient {
  threshold: {
    findFirst(args: {
      where: { commit: { sha: string; installationId: string | null } };
      include?: { commit: true };
    }): Promise<{
      finalThreshold: number;
      finalWindow: number;
      commit: { id: string; sha: string; installationId: string | null };
    } | null>;
  };
  rolloutOutcome: {
    create(args: {
      data: {
        commitId: string;
        installationId: string | null;
        rolledBack: boolean;
        finalErrorRate: number;
        durationMs: number;
      };
    }): Promise<unknown>;
  };
}
```

#### Decision Logic:
1. Extract `commit`, `errorRate`, and optional `durationMs` from request body.
2. Authenticate caller via `resolveInstallationFromAuthHeader(prismaClient, request.headers.authorization)`.
3. Lookup `threshold` for the given commit SHA and matching `installationId`.
4. If not found: return 404 `{ error: "commit not found" }`.
5. Compare `isBreached = errorRate >= threshold.finalThreshold`.
6. If breached:
   - `action = "rollback"`
   - `reason = "threshold_violation"`
7. Else:
   - `action = "continue"`
   - `reason = "within_budget"`
8. If `action === "rollback"` or `durationMs !== undefined`:
   - Asynchronously persist `rolloutOutcome.create(...)` for observability.
9. Return 200 `{ action, reason, finalThreshold, currentErrorRate: errorRate, finalWindow }`.

---

### 3.2 Test Churn Discounting in Tier 1 & Tier 2

#### Tier 1 Pattern Matching:
Add test pattern rules to `classifier/tier1.ts`:
```typescript
const TEST_PATTERNS = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/*_test.go",
  "**/*_test.py",
];
```
In `classifyTier1()`, any file matching `TEST_PATTERNS` before the general `code` rule is classified with `type: "test"`.

#### Weighting & Scoring in Tier 2:
In `classifier/vector.ts`:
- In `TreeSitterComplexityScorer`, test files have their AST churn multiplied by `TEST_COMPLEXITY_DISCOUNT = 0.1`.
- A 1,000-line test refactor will only contribute 10% of equivalent production code complexity, preserving strict error budgets where it matters (business logic).

---

### 3.3 Native `PrometheusAdapter`

Located at `core-api/src/adapters/prometheus.ts`:
```typescript
export interface PrometheusAdapterOptions {
  prometheusUrl: string;
  query: string;
  rollbackCommand?: string;
  fetchFn?: typeof fetch;
  exec?: ExecFn;
}

export class PrometheusAdapter implements RollbackAdapter {
  async checkHealth(target: string): Promise<{ errorRate: number; healthy: boolean }>;
  async rollback(target: string): Promise<void>;
}
```

#### Health Check Flow:
1. Interpolates `target` into the PromQL query if `{target}` placeholder is present, or executes the query directly.
2. Calls `GET ${prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`.
3. Extracts scalar/vector float value.
4. Returns `{ errorRate, healthy: errorRate === 0 }`.

#### Rollback Flow:
Executes the configured `rollbackCommand` using `exec` (e.g. `kubectl rollout undo deployment/${target}` or `docker compose rollback ${target}`).

---

### 3.4 Operational Telemetry (`GET /metrics`)

Located at `core-api/src/routes/metrics.ts`:
- Returns `text/plain; version=0.0.4`.
- Metrics tracked:
  - `carf_commits_analyzed_total{status}`
  - `carf_health_reports_total{action}`
  - `carf_rollbacks_executed_total`
  - `carf_active_watchdogs`
  - `carf_http_requests_total{route, status}`

---

## 4. Verification Plan

1. **Unit Tests:**
   - `test/routes/report.test.ts`: Test `POST /v1/report` for 200 within budget, 200 threshold violation (rollback), 400 invalid body, 401 invalid API key, and 404 unknown commit.
   - `test/classifier/testDiscount.test.ts`: Verify that test files receive the discounted complexity weight and do not inflate code complexity compared to production files.
   - `test/adapters/prometheus.test.ts`: Test `PrometheusAdapter` handling valid PromQL response, NaN/empty response, error rate calculations, and rollback execution.
   - `test/routes/metrics.test.ts`: Verify `GET /metrics` returns valid Prometheus exposition format.
2. **Integration Verification:**
   - Build `core-api` with `npm run build`.
   - Run full test suite with `npm test`.
