# core-api/CLAUDE.md

Backend engine for CARF. TypeScript, Node.js, Fastify. Governed by the repo-wide
rules in `.agents/rules/coding.md` and `.agents/rules/workflow.md` — this file adds
core-api-specific conventions on top, it doesn't replace them.

## Stack
- Language: TypeScript, strict mode on
- Framework: Fastify
- DB/ORM: PostgreSQL + Prisma (schema wired up in Phase 1 even though nothing persists
  yet, so Phase 2's Commit/ChangeVector models aren't a rewrite)
- Glob matching: micromatch
- AST parsing (Tier 2 only): tree-sitter + per-language grammar packages
- Test runner: Vitest

## Package layout
`core-api/` is a standalone package — its own `package.json`/lockfile, same pattern
`web/` already uses. No root npm/pnpm workspace.

## Folder structure
```
core-api/
  src/
    classifier/          # Tier 1, Tier 2, CodeComplexityScorer, vector normalization — pure logic, no I/O
      tier1.ts
      tier2.ts
      codeComplexityScorer.ts
      vector.ts
    adapters/
      github/             # webhook receiver, installation token auth, diff acquisition
    routes/                # Fastify route handlers (thin — delegate to classifier/adapters)
    prisma/                # schema.prisma, migrations
    config/                # env var loading/validation
  test/
    classifier/
    adapters/github/
  .env.example
```

## Architectural rules
- `classifier/` is pure: no network calls, no DB access, no filesystem access. Every
  function in this folder must be unit-testable with in-memory fixtures only.
- `classifyCommit()` in `vector.ts` is the single entry point the rest of the app calls
  — routes and future threshold-engine code never import `tier1.ts`/`tier2.ts` directly.
- `classifyCommit()` returns `ChangeVector | null`. `null` means "no signal, skip
  threshold computation" — callers must never coerce it into a zero vector.
- Tier 2 is injected via the `CodeComplexityScorer` interface (see #18), defaulting to
  `StubComplexityScorer` until #7's real tree-sitter implementation lands. This keeps
  #6/#8 unblocked by #7.
- core-api is stateless: no local git checkout, no persistent disk state. All file
  content comes from the GitHub API (`adapters/github/diffAcquisition.ts`), authenticated
  via GitHub App installation tokens — never a bare PAT.

## Testing
- Vitest, colocated under `core-api/test/`, mirroring `src/` structure, `*.test.ts`.
- Every classifier function gets unit tests; acceptance criteria on each GitHub issue
  define the required coverage — don't mark an issue ready for PR until they're met.
- External calls (GitHub API) must be mockable via an interface-based HTTP client —
  classifier and acquisition tests never hit the network.

## Commits / PRs
- Branch per issue, PR per issue (not batched), semantic commit prefixes.
- PR description explains the change and reasoning per `.agents/rules/workflow.md`.
- Assign PRs to `dineshkorukonda`.
