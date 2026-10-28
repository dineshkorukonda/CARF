# Integration support and verification

CARF policy computation is implemented. Runtime control depends on the execution host; installing the verification agent on another machine does not connect a remote deployment executor.

| Integration / runtime | Production wiring | Evidence and remaining work |
| --- | --- | --- |
| GitHub Actions + PM2 | Managed CI-gated deployment, observation, Actions rollback request | Unit/route/shell tests and isolated real PM2 lifecycle passed on 2026-10-28; hosted GitHub delivery still needs acceptance testing |
| PM2 | Local core-api host only | Bind CARF_LOCAL_INSTALLATION_ID, configure a repository target, and verify it |
| Docker Compose | Local core-api host; exact SHA image selection and saved image rollback | Contract tests; requires a real Compose daemon acceptance run; dashboard auto-generated managed deployment workflow currently targets PM2 |
| Generic HTTP / CI | Threshold reads and persisted health verdicts | External pipeline executes rollback; HTTP adapter notifications are not execution acknowledgments |
| Argo Rollouts | Preview: external policy integration | Reference controller manifests and adapter contract tests; cluster installation and CARF policy wiring require acceptance testing |
| Kubernetes runtime | Preview | Adapter and reference manifests exist; standalone config accepts only PM2/Docker |
| systemd runtime | Roadmap | Library adapter unit tests only; no managed standalone config or reference environment |
| Prometheus / PromQL | Library telemetry adapter and external CI reporting | Unit tests; not selectable as a standalone .carf.yml health source |
| Remote host agent execution | Not implemented | Agent verifies, heartbeats, and updates; no remote deploy/rollback transport |

## Repeatable checks

After installing core-api dependencies, run `node environments/validate-environments.mjs` from the repository root. This parses YAML and checks required artifacts. It deliberately reports STATIC-VALIDATED and runtimeVerified=false. `--require-live` exits nonzero; file presence or an available CLI is not proof of live recovery.

Run core-api tests for adapter contracts and route wiring. For real PM2 lifecycle testing, run `CARF_TEST_REAL_PM2=1 npm test -- test/integration/pm2Live.test.ts` inside core-api. The suite uses a private PM2_HOME and disposable application. Run cluster/container reference scripts only against disposable infrastructure you control.

See [audit validation and rollout requirements](../validation/audit-remediation.md) for migration and host setup. None of the reference manifests alone establishes production readiness.

## Removed integrations and capability previews

Flagger is removed. Historical values remain stored and resolve as unsupported; explicitly reconfigure to a supported integration. No migration silently converts those values.

The backend-owned capability resolver is also imported by setup previews. Previews without backend host authorization show policy only. PM2/Docker execution requires the configured adapter and the installation-bound local host. See [architecture remediation](../validation/architecture-alignment.md) for remaining UI integration work and verification semantics.

The production observation policy remains the maximum decayed active-category window (issue #150). Empty classification skips policy computation; direct empty or out-of-bounds vectors are rejected. Historical stored thresholds and windows are unchanged.
