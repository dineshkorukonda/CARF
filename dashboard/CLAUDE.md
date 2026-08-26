# dashboard/CLAUDE.md

The CARF dashboard: GitHub OAuth login, GitHub App install flow, mode/adapter and
classification/threshold config (committed to `.carf.yml` via the GitHub API), and a
live status view backed by core-api's `GET /v1/commits`. Governed by the repo-wide rules
in `.agents/rules/coding.md` and `.agents/rules/workflow.md` -- this file adds
dashboard-specific conventions on top.

## Stack
- Language: TypeScript, strict mode on
- Framework: Next.js (App Router), same major version as `web/` -- see `web/AGENTS.md`:
  this is not the Next.js your training data knows, check `node_modules/next/dist/docs/`
  before writing App Router code.
- UI: shadcn/ui (`@base-ui/react` primitives), matching `web/`'s `components.json` style
  (`base-nova`, `neutral` base color). Base UI is polymorphic via a `render` prop, not
  Radix's `asChild`.
- DB/ORM: PostgreSQL + Prisma, own `prisma/schema.prisma` (`Account`/`Installation`) --
  can share core-api's Postgres instance without table-name collisions, but this package
  never imports core-api's Prisma client or vice versa.
- Test runner: Vitest, same convention as `core-api/`.

## Package layout
`dashboard/` is a standalone package -- own `package.json`/lockfile, no root npm/pnpm
workspace, same pattern `core-api/` and `web/` already use.

```
dashboard/
  src/
    adapters/github/     # GitHub OAuth + App JWT/install-lookup/repos/contents clients -- pure, injectable fetch, no cookies/DB
    adapters/coreApi/    # core-api's GET /v1/commits + GET /v1/installations/:id/api-key clients -- same convention
    lib/                 # session signing, account/installation persistence, .carf.yml read/write, core-api key caching, Prisma singleton
    config/               # env var loading
    app/                 # App Router pages + route handlers
  prisma/                # schema.prisma, migrations
  test/                   # mirrors src/ structure, *.test.ts
```

## Architectural rules
- GitHub API clients under `src/adapters/github/` never read cookies or touch Prisma --
  they take plain arguments and an injectable `fetch`, mirroring
  `core-api/src/adapters/github/`'s testable-client convention. Route handlers are the
  composition root that wires them to cookies/session/DB.
- `src/lib/accountService.ts` takes a `DashboardPrismaClient` interface, not the concrete
  `@prisma/client` type, so tests can supply an in-memory fake (see
  `core-api/src/pipeline.ts`'s `PipelinePrismaClient` for the same pattern).
- Login is the dashboard's own email/password auth (`src/lib/accountService.ts`'s
  `createAccount`/`verifyCredentials`, bcrypt-hashed via `bcryptjs`) -- deliberately not
  tied to GitHub identity. An `Account` is just "someone who signed up," fully separate
  from which repos a GitHub App installation has been linked to (see `linkInstallation`).
- Session is a signed (HMAC), not encrypted, cookie -- see `src/lib/session.ts`'s doc
  comment for why that's sufficient here.
- The dashboard never talks to a repo's GitHub API on behalf of a user with anything but
  the GitHub App's own credentials (App JWT for install lookups) -- no bare PAT, matching
  core-api's own rule. This is unrelated to login: the GitHub App is authorized
  independently of any dashboard `Account`.
- Cross-service auth to core-api (issue #65's per-installation API keys) is wired up via
  `src/lib/coreApiAccess.ts`'s `ensureCoreApiKey` (issue #64): the dashboard proves App-level
  control with its own GitHub App JWT against core-api's `GET /v1/installations/:id/
  api-key`, which rotates in a fresh key (the plaintext can't be read back any other way --
  only a hash is ever stored on core-api's side) and caches it on the `Installation` row.
  Never send that cached key to the browser -- `/api/status/[installationId]` proxies core-
  api calls so it stays server-side.
- Config edits (#62's mode/adapter, #63's classification/threshold) never touch a
  dashboard-owned database -- they commit directly to the target repo's `.carf.yml` via
  the GitHub Contents API, authenticated with a freshly-minted installation access token
  (never a user PAT). `src/lib/carfConfigWriter.ts` owns the merge-in-place logic; `src/
  lib/carfConfigSchema.ts` is a hand-mirrored (not imported) subset of core-api's
  `carfConfigSchema.ts` -- see that file's doc comment for why staying byte-for-byte in
  sync isn't required for correctness.

## Testing
- Vitest, colocated under `dashboard/test/`, mirroring `src/`.
- Everything under `src/adapters/github/` and `src/lib/` (except the Prisma singleton
  itself and Next.js route handlers, which need a running Next.js/DB to integration-test)
  gets unit tests with fakes/mocks, no real network or DB calls.
