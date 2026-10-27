# Integration support and verification

CARF policy computation is implemented. Runtime control depends on the execution host; installing the verification agent on another machine does not connect a remote deployment executor.

| Integration / runtime | Production wiring | Evidence and remaining work |
| --- | --- | --- |
| GitHub Actions + PM2 | Managed CI-gated deployment, observation, Actions rollback request | Unit/route/shell tests and opt-in real PM2 lifecycle suite; hosted GitHub delivery still needs acceptance testing |
| PM2 | Local core-api host only | Bind CARF_LOCAL_INSTALLATION_ID, configure a repository target, and verify it |
| Docker Compose | Local core-api host; exact SHA image selection and saved image rollback | Contract tests; requires a real Compose daemon acceptance run; dashboard auto-generated managed deployment workflow currently targets PM2 |
| Generic HTTP / CI | Threshold reads and persisted health verdicts | External pipeline executes rollback; HTTP adapter notifications are not execution acknowledgments |
| Argo Rollouts | Preview: external policy integration | Reference controller manifests and adapter contract tests; cluster installation and CARF policy wiring require acceptance testing |
| Flagger | Preview: external policy integration | Reference native metric canary and adapter contract tests; sample canary does not call CARF policy |
| Kubernetes runtime | Preview | Adapter and reference manifests exist; standalone config accepts only PM2/Docker |
| systemd runtime | Roadmap | Library adapter unit tests only; no managed standalone config or reference environment |
| Prometheus / PromQL | Library telemetry adapter and external CI reporting | Unit tests; not selectable as a standalone .carf.yml health source |
| Remote host agent execution | Not implemented | Agent verifies, heartbeats, and updates; no remote deploy/rollback transport |

## Repeatable checks

After installing core-api dependencies, run `node environments/validate-environments.mjs` from the repository root. This parses YAML and checks required artifacts. It deliberately reports STATIC-VALIDATED and runtimeVerified=false. `--require-live` exits nonzero; file presence or an available CLI is not proof of live recovery.

Run core-api tests for adapter contracts and route wiring. For real PM2 lifecycle testing, run `CARF_TEST_REAL_PM2=1 npm test -- test/integration/pm2Live.test.ts` inside core-api. The suite uses a private PM2_HOME and disposable application. Run cluster/container reference scripts only against disposable infrastructure you control.

See [audit validation and rollout requirements](../validation/audit-remediation.md) for migration and host setup. None of the reference manifests alone establishes production readiness.
