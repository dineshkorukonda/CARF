# GitHub Actions and PM2 validation

## Regressions corrected

- Setup discarded the array returned by `/v1/pm2/apps`, hiding discovered processes.
- Setup prefilled the repository name before discovery, preventing selection of the actual PM2 name.
- Status accepted case-insensitive names, verification required exact names, and reload only guessed lowercase names. Runtime commands now resolve unambiguous aliases from PM2 discovery; exact names take precedence.
- Saving unchanged setup/config values always committed `.carf.yml`. Parsed YAML equality now avoids those writes and preserves original comments on unchanged saves. Partial adapter edits retain existing build/probe settings.
- Policy lookup used case-sensitive owner/repository names. Production never wired the existing on-demand policy path. Authenticated requests now classify the exact requested commit without deploying it or starting live monitoring.
- GitHub Actions verification could refresh commits with live deployment enabled. It now requests classification only.
- Selecting a process in the dashboard updated its connection but runtime operations used the old YAML/global adapter. Webhook deployment, manual rollback, and recovery now use saved repository settings.
- Boot recovery constructed the rollback adapter with the current commit, instead of its base commit.
- Git verification passed without a Git checkout. It now fails when rollback cannot use Git.
- Process association/status lookups were not installation-scoped; process changes could also grant verification without checks. They now enforce ownership and invalidate verification when the target changes.
- Repository-specific fake process/status defaults were removed.

## Automated checks

From each package, run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

The real runtime test requires Git, Node, and PM2 on PATH. It creates a temporary Git checkout and a private `PM2_HOME`, starts an HTTP fixture returning 500, discovers its mixed-case process, rolls back to the healthy commit, and verifies HTTP 200. It terminates its isolated daemon afterward.

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
5. Run the repository's CARF workflow for the failed SHA. It should return threshold/window/vector, including when the original push webhook was missed. Preserve installation authentication.
6. Use a disposable target repository/process for a healthy deployment, HTTP failure, automatic rollback, manual rollback, and CARF restart during an active observation window. Verify the target Git revision and PM2 process after each operation.
7. Inspect the full dashboard/core error logs, including the lines preceding any timeout exception. The supplied excerpt contains only exception constants and is insufficient to diagnose its origin.

Local runtime validation does not establish production server access, reverse-proxy routing, GitHub webhook delivery, or correctness of the deployed build. Those require the live acceptance checks above.
