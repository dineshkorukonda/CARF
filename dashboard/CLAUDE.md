# dashboard/CLAUDE.md

The CARF dashboard: GitHub OAuth login, GitHub App install flow, and (in later issues)
mode/adapter configuration, classification/threshold config, and live status views.
Governed by the repo-wide rules in `.agents/rules/coding.md` and
`.agents/rules/workflow.md` -- this file adds dashboard-specific conventions on top.

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
    adapters/github/     # GitHub OAuth + App JWT/install-lookup clients -- pure, injectable fetch, no cookies/DB
    lib/                 # session signing, account/installation persistence, Prisma singleton
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
- Session is a signed (HMAC), not encrypted, cookie -- see `src/lib/session.ts`'s doc
  comment for why that's sufficient here.
- The dashboard never talks to a repo's GitHub API on behalf of a user with anything but
  the GitHub App's own credentials (App JWT for install lookups) -- no bare PAT, matching
  core-api's own rule.
- Cross-service auth between this dashboard and core-api's dashboard-facing endpoints
  (issue #65) is explicitly out of scope for issue #61 -- this package only owns
  login/install and persisting `installationId` against an `Account`.

## Testing
- Vitest, colocated under `dashboard/test/`, mirroring `src/`.
- Everything under `src/adapters/github/` and `src/lib/` (except the Prisma singleton
  itself and Next.js route handlers, which need a running Next.js/DB to integration-test)
  gets unit tests with fakes/mocks, no real network or DB calls.
