# Architecture remediation — 2026-10-28

This change uses the confirmed requirements and repository contracts. The architecture DOCX, evaluation DOCX, and research PDF were unavailable. No historical experiments, migrations, production configuration, or database records were changed.

## Alignment decisions

| Mismatch | Implemented resolution |
| --- | --- |
| Removed controller still selectable | Flagger adapter, factory branch, schema choices, detector, UI examples, reference environment and obsolete tests removed. Unknown deployment integration resolves unsupported with no capabilities; factory and setup reject it. Historical migration values remain readable and are never silently remapped. |
| Duplicate capability algorithms | Dashboard imports the backend-owned pure resolver. Parity tests assert implementation identity and all selection combinations. |
| Runtime name granted execution | Runtime selection alone grants no monitoring/rollback. Backend orchestration supplies local installation authorization and matching configured adapter evidence. Argo combinations cannot grant local PM2/Docker execution. |
| Standalone mode or arbitrary target implied PM2 | Explicit adapter kind or PM2-specific process/layout evidence is required for legacy selection. Adapter configuration rejects ambiguous targets and unsupported kinds. |
| Empty policy serialized non-finite numbers | Direct empty vectors raise RangeError. Normal classification returns null and existing callers skip computation. No fabricated threshold is persisted. Finite vector magnitudes and decay must lie in [0,1]; baselines must be positive finite safe numbers. |
| Observation window disagreement | Preserve maximum decayed active-category window, per issue #150, so mixed infra/data changes retain data observation time. Threshold remains minimum. Default v1 tuning and nonempty valid results are unchanged. Existing persisted policy results remain untouched. |
| Command success/health mistaken for restoration | PM2 checks previous revision and health; Docker checks previous image reference and health. Identity lookup failure/mismatch is unverified. Kubernetes/systemd report unverified because only health is checked. Argo undo failures propagate. |

CARF supplies policy, observation and rollback decisions around existing deployment tools. Deployment integrations are GitHub Actions, Generic HTTP/custom CI, and preview Argo Rollouts. Runtime choices are none, PM2, Docker, preview Kubernetes and roadmap systemd. Prometheus is optional telemetry, Grafana visualization. Neither is a deployment runtime.

## Scope and remaining work

- Shared setup previews are conservative: they do not assert host execution capabilities before backend validation. A dedicated authenticated backend capability-read endpoint and live dashboard refresh remain unfinished; current dashboard reads do not receive positive host authorization evidence.
- Optional monitoring selection is not yet fully wired through setup. PromQL remains a library adapter.
- Historical migrations that inferred PM2 from standalone were retained, not rewritten. Explicit stored runtime columns are still honored as selections, but no execution is granted without current backend configuration/authorization. Operator review of ambiguous migrated rows remains necessary.
- Restoration checks establish revision/image identity plus observed health, not independent proof of business correctness. PM2 disk revision checks cannot prove every worker loaded identical code. Docker tag-only baselines are weaker than captured immutable image IDs.
- Kubernetes/systemd restoration identity and managed execution remain unavailable. Argo controller bridging and live undo verification require cluster work. Generic HTTP notifications are not execution acknowledgments.
- No new experiment results or recalibrated/ML scoring claims are made. Existing outcome fields retain execution and verification separately. Full policy provenance for new experiments still needs a separate additive persistence change.
- Database integration tests require isolated PostgreSQL; absent database tests remain skipped. Container/cluster live validation was not performed.

## Verification semantics

A rollback request is not execution. Successful execution is not restoration. Restoration identity and healthy observations together permit a verified result. Missing identity or unhealthy observations result in rollbackVerified=false. Existing locks, leases, recovery paths, rollback target capture, authentication and idempotency code remain in place.

## Commands and results for this checkout

- core-api baseline: `npm test -- test/adapters/pm2.test.ts test/config/repoAdapterConfig.test.ts test/threshold/engine.test.ts`: 42 passed.
- core-api: `npm test`: 634 passed, 14 skipped, 0 failed. `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- dashboard: `npm test`: 508 passed, 6 skipped, 0 failed. `npm run typecheck`, `npm run lint`, `npm run build`: passed. After the final runtime-selection guard, `npm test -- test/routes/repoLink.test.ts test/routes/onboardingSeparation.test.ts`: 18 passed.
- agent: `npm ci --ignore-scripts`, `npm test`: 5 passed.
- root: `node environments/validate-environments.mjs`: 8 static environment groups validated, runtimeVerified=false for all.
- core-api live PM2: PowerShell `$env:CARF_TEST_REAL_PM2='1'; npm test -- test/integration/pm2Live.test.ts`: 1 passed, using a private PM2_HOME and disposable application. Verified exact previous Git revision, rebuild and HTTP 200 after rollback. Production applications were not used.
- Dependencies: `npm ci --ignore-scripts` in core-api/dashboard; `npx prisma generate` in both packages (client generation only, no database migration). `npm audit --json` and `npm audit --omit=dev --json` in both packages returned vulnerabilities; see dependency-audit.md.
- `git diff --check`: passed.

Initial typecheck/build failed because Prisma clients had not been generated after installation with scripts disabled; generation resolved this. Intermediate suites exposed old capability/window expectations, the removed environment count, an existing terminology violation, setup persistence relying on preview capabilities, and tests equating health with restoration. These were corrected and rerun. No failing test was silently skipped to obtain the final counts. Existing database and opt-in infrastructure skips remain; the PM2 opt-in test was separately run successfully.

Final dashboard lint initially reported one unused Terminal icon after integration removal; removed it and reran `npx eslint src/app/dashboard/setup/DeploymentIntegrationStep.tsx` successfully. Final dashboard production build exited 0. Next.js emitted existing workspace-root and middleware-convention warnings.
