# Backend Core Protocol Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the missing core protocol interfaces in `core-api`: the `POST /v1/report` health evaluation endpoint, test file churn discounting in the Tier 1 & 2 AST classifier, the native `PrometheusAdapter`, and operational Prometheus `/metrics`.

**Architecture:** 
Fastify routes and pure classifier/adapter modules in `core-api`. `POST /v1/report` validates incoming APM health readings against persisted dynamic thresholds with tenant isolation. Test-file detection dampens non-production churn so test PRs do not shrink production budgets. `PrometheusAdapter` evaluates PromQL error rates for standalone deployments, and `GET /metrics` provides Prometheus exposition telemetry.

**Tech Stack:** Fastify, TypeScript, Prisma Client, Tree-sitter, Node.js.

**Spec:** `docs/superpowers/specs/2026-09-14-backend-core-protocol-extensions-design.md`

## Global Constraints
- Pure logic remains pure: classifier files never perform DB or network operations directly.
- Multi-tenant data isolation: requests with `installationId` require matching bearer API key validation.
- Zero extra runtime dependencies: use Fastify schemas and Node `fetch`/Prometheus text formats.
- All tests run via node test runner (`npm test` in `core-api`).

---

### Task 1: `POST /v1/report` Health Ingestion Route

**Files:**
- Create: `core-api/src/routes/report.ts`
- Modify: `core-api/src/app.ts`
- Create: `core-api/test/routes/report.test.ts`

**Interfaces:**
- Consumes: `resolveInstallationFromAuthHeader` from `core-api/src/auth/installationAuth.js`, `defaultPrisma` from `core-api/src/db/client.js`.
- Produces: `registerReportRoute(app, options)` handling `POST /v1/report`.

- [ ] **Step 1: Write failing tests for `POST /v1/report`**
Create `core-api/test/routes/report.test.ts` covering:
- 200 `{ action: "continue", reason: "within_budget" }` when `errorRate < finalThreshold`.
- 200 `{ action: "rollback", reason: "threshold_violation" }` when `errorRate >= finalThreshold`, ensuring `rolloutOutcome.create` is invoked.
- 400 for missing `commit` or invalid `errorRate`.
- 401 for invalid API key when commit is installation-scoped.
- 404 when commit or threshold is not found.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test test/routes/report.test.ts` inside `core-api`
Expected: FAIL with module/route not found.

- [ ] **Step 3: Implement `core-api/src/routes/report.ts` and register in `app.ts`**
Implement the route with Fastify schema validation, tenant resolution, threshold comparison, and outcome logging.

- [ ] **Step 4: Run test to verify passing**
Run: `npm test test/routes/report.test.ts` inside `core-api`
Expected: All tests PASS.

- [ ] **Step 5: Commit**
```bash
git add core-api/src/routes/report.ts core-api/src/app.ts core-api/test/routes/report.test.ts
git commit -m "feat(core-api): add POST /v1/report health evaluation route"
```

---

### Task 2: Test File Churn Discounting in Tier 1 & Tier 2 AST

**Files:**
- Modify: `core-api/src/classifier/tier1.ts`
- Modify: `core-api/src/classifier/codeComplexityScorer.ts`
- Modify: `core-api/src/classifier/vector.ts`
- Create: `core-api/test/classifier/testDiscount.test.ts`

**Interfaces:**
- Consumes: `classifyTier1`, `classifyCommit`, `TreeSitterComplexityScorer`.
- Produces: `isTestFile(path)` logic and dampened AST complexity for test files.

- [ ] **Step 1: Write failing tests for test churn discounting**
Create `core-api/test/classifier/testDiscount.test.ts`:
- Verify `classifyTier1` identifies `src/app.test.ts` and `tests/helper.py` as `test`.
- Verify `classifyCommit` dampens test file complexity so a 100-line test change produces significantly lower `code_complexity` than a 100-line production change.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test test/classifier/testDiscount.test.ts` inside `core-api`
Expected: FAIL.

- [ ] **Step 3: Implement test patterns and dampening**
- In `tier1.ts`, add `test` patterns before generic `code` patterns.
- In `codeComplexityScorer.ts` / `vector.ts`, apply a `0.1x` dampening factor for `test` files when computing complexity score.

- [ ] **Step 4: Run test to verify passing**
Run: `npm test test/classifier/testDiscount.test.ts` inside `core-api`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add core-api/src/classifier/tier1.ts core-api/src/classifier/codeComplexityScorer.ts core-api/src/classifier/vector.ts core-api/test/classifier/testDiscount.test.ts
git commit -m "feat(core-api): discount test file churn in AST complexity scoring"
```

---

### Task 3: Native Prometheus Rollback Adapter

**Files:**
- Create: `core-api/src/adapters/prometheus.ts`
- Modify: `core-api/src/config/carfConfigSchema.ts`
- Create: `core-api/test/adapters/prometheus.test.ts`

**Interfaces:**
- Consumes: `RollbackAdapter` from `core-api/src/adapters/rollbackAdapter.js`, `ExecFn` from `core-api/src/adapters/execFn.js`.
- Produces: `PrometheusAdapter` implementing `checkHealth` and `rollback`.

- [ ] **Step 1: Write failing tests for `PrometheusAdapter`**
Create `core-api/test/adapters/prometheus.test.ts`:
- Test `checkHealth` queries Prometheus API and extracts vector float value.
- Test `checkHealth` returns `{ errorRate: 0.02, healthy: false }` for non-zero rate.
- Test `rollback` executes configured shell command.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test test/adapters/prometheus.test.ts` inside `core-api`
Expected: FAIL.

- [ ] **Step 3: Implement `PrometheusAdapter`**
Implement the class in `core-api/src/adapters/prometheus.ts` with injectable `fetchFn` and `exec`. Update `carfConfigSchema.ts` to accept `kind: "prometheus"` in `adapter`.

- [ ] **Step 4: Run test to verify passing**
Run: `npm test test/adapters/prometheus.test.ts` inside `core-api`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add core-api/src/adapters/prometheus.ts core-api/src/config/carfConfigSchema.ts core-api/test/adapters/prometheus.test.ts
git commit -m "feat(core-api): add native Prometheus PromQL rollback adapter"
```

---

### Task 4: Operational Telemetry (`GET /metrics`)

**Files:**
- Create: `core-api/src/routes/metrics.ts`
- Modify: `core-api/src/app.ts`
- Create: `core-api/test/routes/metrics.test.ts`

**Interfaces:**
- Produces: `registerMetricsRoute(app)` exposing Prometheus text format on `GET /metrics`.

- [ ] **Step 1: Write failing tests for `GET /metrics`**
Create `core-api/test/routes/metrics.test.ts`:
- Verify `GET /metrics` responds with `200 text/plain`.
- Verify standard Prometheus metrics (`carf_commits_analyzed_total`, `carf_health_reports_total`, `carf_rollbacks_executed_total`) are present.

- [ ] **Step 2: Run test to verify failure**
Run: `npm test test/routes/metrics.test.ts` inside `core-api`
Expected: FAIL.

- [ ] **Step 3: Implement `core-api/src/routes/metrics.ts` and wire into `app.ts`**
Implement metrics registry and Fastify route.

- [ ] **Step 4: Run test to verify passing**
Run: `npm test test/routes/metrics.test.ts` inside `core-api`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add core-api/src/routes/metrics.ts core-api/src/app.ts core-api/test/routes/metrics.test.ts
git commit -m "feat(core-api): add Prometheus /metrics exposition endpoint"
```

---

### Task 5: Full Build & Test Suite Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run all tests in `core-api`**
Run: `npm test` in `core-api`
Expected: All existing and new tests pass with zero regressions.

- [ ] **Step 2: Run TypeScript build in `core-api`**
Run: `npm run build` in `core-api`
Expected: Clean compilation with zero type errors.

- [ ] **Step 3: Final commit & push**
```bash
git status
git push origin main
```
