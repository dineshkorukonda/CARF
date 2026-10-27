# Audit remediation and deployment requirements

Issues #222 through #228 track the audit fixes. All audit remediation fixes are consolidated into a single PR targeting main. The changes have not been deployed to production by this work.

## Database and host rollout

core-api owns migrations for both services. Run `npm run db:migrate:deploy` inside core-api before restarting services; regenerate both Prisma clients. The new migrations replace rollout uniqueness with installation+owner+repository+SHA, add persisted HealthReport verdicts, and save deployed runtime revision separately from Git SHA, and make the historical rollout duration nullable. Backfill of legacy repository identity uses the linked Commit. Legacy outcomes with no repository identity cannot be safely recovered.

Set CARF_LOCAL_INSTALLATION_ID on the core-api host to opt one trusted installation into local PM2/Docker operations. With it unset, host discovery, verification, and command execution are refused. A remote verification agent is not a remote deployment executor. Policy-only hosted operation requires no local binding.

Deployments and observations share a repository lease independent of SHA, with holder-specific renewal and release. Manual rollback refuses stale revisions and uses an atomic outcome claim. During rolling upgrades, stop old core workers before enabling the new lease protocol; old binaries do not honor the repository-wide lease. Leases cannot revoke an external shell command already in progress, so do not operate competing deployment tools on the same target.

Review retained logs for previously exposed installation credentials and rotate affected credentials through the normal installation-secret flow when needed. No production credentials were rotated automatically.

## Validation evidence

Run both package test suites, typechecks, lint, builds, schema parity, and `node environments/validate-environments.mjs`. Run database tests against a disposable PostgreSQL database after canonical migrations. Run the PM2 opt-in lifecycle test with a private PM2_HOME. Docker and cluster contracts use injected command executors; live verification requires the actual daemon/controllers and is not inferred from those tests.

See the integration support matrix for unimplemented remote execution, controller bridges, and PromQL standalone wiring. These remain explicitly unsupported rather than silently routed to the core host.

## Local run results

The canonical migration chain was applied to a new isolated PostgreSQL database. Both new database regressions passed: same-SHA repositories retain distinct outcomes, and health reports persist without creating deployment outcomes. The first database run exposed the historical NOT NULL durationMs column; the compatibility migration preserves old values and permits current writes.

Full suites: core-api 635 passed (two intentionally skipped), dashboard 519 passed including database tests, agent 5 passed. The separate real PM2 lifecycle test passed on Windows using a private PM2_HOME and a disposable Git application. Both TypeScript builds and schema parity passed. A Prisma migration-to-schema diff reported no differences after aligning historical database defaults. The local production dashboard returned 401 from machine authentication handlers, 200 for both installer artifacts, and a session redirect for /dashboard.

No Docker CLI, service mesh, Argo/Flagger controller, or live Prometheus target was available for lifecycle acceptance. Their mocked/static coverage is identified separately in the support matrix. No production deployment, credential rotation, or cluster mutation was performed.

Cross-platform agent CI exposed a Windows checkout failure: CRLF conversion made the Vitest/Vite ESM loader reject the agent's shebang. Converting the source to CRLF reproduced the exact failure locally. Git attributes now preserve LF for executable JavaScript modules and shell scripts; an earlier Windows/Linux Node 22/24 run verified checkout behavior. Current automated agent checks run on Linux with Node 22 and 24 only.
