# GitHub Actions and PM2 validation

## Regressions corrected

- Setup discarded the array returned by `/v1/pm2/apps`, hiding discovered processes.
- Setup prefilled the repository name before discovery, preventing selection of the actual PM2 name.
- Status accepted case-insensitive names, verification required exact names, and reload only guessed lowercase names. Runtime commands now resolve unambiguous aliases from PM2 discovery; exact names take precedence.
- Saving unchanged setup/config values always committed `.carf.yml`. Parsed YAML equality now avoids those writes and preserves original comments on unchanged saves. Partial adapter edits retain existing build/probe settings.
- Policy lookup used case-sensitive owner/repository names. Production never wired the existing on-demand policy path. Authenticated requests now classify the exact requested commit without deploying it or starting live monitoring.
- GitHub Actions verification could refresh commits with live deployment enabled. It now requests classification only.
- Dashboard history refresh explicitly sends `observeLive: false`, including when talking to an older core-api. Empty-diff historical commits are skipped; actual classification failures can be expanded in the UI. Policy badges are labeled separately from measured runtime metrics.
- Selecting a process in the dashboard updated its connection but runtime operations used the old YAML/global adapter. Webhook deployment, manual rollback, and recovery now use saved repository settings.
- Boot recovery constructed the rollback adapter with the current commit, instead of its base commit.
- Git verification passed without a Git checkout. It now fails when rollback cannot use Git.
- Process association/status lookups were not installation-scoped; process changes could also grant verification without checks. They now enforce ownership and invalidate verification when the target changes.
- Repository-specific fake process/status defaults were removed.

## Automated checks

From each package, run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

The real runtime test requires Git, Node, and PM2 on PATH. It creates a temporary Git checkout and a private `PM2_HOME`, builds a healthy HTTP fixture, skips an intermediate commit, deploys an unhealthy revision through the adapter, and rebuilds the captured healthy revision on rollback. It verifies HTTP 200 and terminates its isolated daemon afterward.

Linux:

```sh
cd core-api
CARF_TEST_REAL_PM2=1 npm test -- test/integration/pm2Live.test.ts
```

PowerShell:

```powershell
cd core-api
$env:CARF_TEST_REAL_PM2 = '1'
npm test -- test/integration/pm2Live.test.ts
```

The core GitHub Actions workflow runs this test on Ubuntu in the `pm2-runtime` job. Database-backed tests run in the existing PostgreSQL CI jobs; without `DATABASE_URL`, they skip locally.

## Production acceptance checks

After deploying both packages, with the dashboard signed in and the correct server user/PM2_HOME:

1. Open the repository setup and select PM2. Confirm discovery shows the actual names and working directories from `pm2 jlist`.
2. Select the target's exact name and verify its health URL and Git/release layout. Do not grant verification to a non-Git directory when Git rollback is selected.
3. Save setup twice without changes. The second save should create no `.carf.yml` commit. Changed settings still produce a configuration commit.
4. Verify GitHub Actions integration. This operation should fetch/classify policy without reloading the application or creating a new live rollout.
5. For augment projects, the CARF workflow reads policy only. For standalone PM2, configure the CI-gated workflow below and push a classified change; do not use the old policy workflow as proof of deployment.
6. Use a disposable target repository/process for a healthy deployment, HTTP failure, automatic rollback, manual rollback, and CARF restart during an active observation window. Verify the target Git revision and PM2 process after each operation.
7. Inspect the full dashboard/core error logs, including the lines preceding any timeout exception. The supplied excerpt contains only exception constants and is insufficient to diagnose its origin.

Local runtime validation does not establish production server access, reverse-proxy routing, GitHub webhook delivery, or correctness of the deployed build. Those require the live acceptance checks above.

## Activate CI-gated PM2 deployment

Standalone PM2 + GitHub Actions now classifies pushes immediately but defers deployment until CI succeeds. Existing policy-only workflows require Reconfigure after both CARF packages are deployed. Other standalone adapters retain their existing behavior.

1. Grant the CARF GitHub App **Actions: Read**, alongside its existing Contents, Workflows, and Secrets write permissions. Accept the permission update on the installation.
2. Keep an active workflow named **CI** that runs on pushes to the repository's default branch. Sahaay already has this workflow. A failed, cancelled, PR, fork, or non-default-branch CI run cannot authorize deployment.
3. In Sahaay Settings / Edit connection, select `sahaay`, Git layout, cwd `/opt/sahaay/my-app`, health URL `http://127.0.0.1:3000`, and build command `npm ci && npm run build`. Save and verify. Apps that need no compilation must explicitly use `true` as their build command. Avoid Sahaay's `deploy.sh`: it pulls main itself and cannot rebuild an older rollback revision.
4. Select **Reconfigure** in GitHub Actions Settings. Confirm `.github/workflows/carf.yml` is version 2, named **CARF PM2 Deployment**, and verification shows successful-CI gating and the deployment step.
5. Push one healthy code change. Wait for **CI**, then **CARF PM2 Deployment**. The second workflow reads policy for `workflow_run.head_sha`, sends the CI run ID and exact SHA, and waits for the CARF rollout outcome. CARF independently verifies the run against GitHub; an outdated branch tip is rejected before deployment.
6. Check the host's Git revision, PM2 status, CARF rollout samples, and HTTP health. A healthy rollout finishes green in Actions. A threshold breach restores and rebuilds the captured deployed revision, verifies health, and reports the rollback as a failed deployment in Actions.
7. Test failed CI (no reload or rollout), a deliberately unhealthy HTTP release (automatic rollback), and a CARF restart during observation (saved rollback revision survives recovery) in a disposable app first. Allow each observation window to finish before the next test commit.

Deployment/build failure attempts recovery and records FAILED even if the prior release was restored. A deployment secret does not authorize bypassing CI. Commit refresh defaults to classification only; an explicit deployment requires `expectedSha`, `observeLive: true`, and `ciRunId`. Rollout status is installation-scoped at `/v1/rollouts/status?owner=...&repo=...&sha=...`.

The startup/observation clock begins after the build and PM2 reload, and the deployment lease renews during long builds. PM2 HTTP probes have a five-second timeout so an unresponsive endpoint counts as a failed probe.

The managed workflow currently requires the name `CI` and the default branch. Documentation-only/no-signal commits do not receive a fabricated policy; the workflow stops at the policy step. Automatic rollback restores application code/build output, not database migrations. Git layout rebuilds in place; use release directories when deployment needs atomic artifact replacement.
