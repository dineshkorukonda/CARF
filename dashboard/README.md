# CARF Dashboard

Team-facing dashboard for onboarding onto CARF: sign in with GitHub, install the CARF
GitHub App on your repo(s), and (in later issues) configure mode/adapter, classification
and threshold rules, and view live rollback status.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in real values, see comments in .env.example
npm run db:generate
npm run db:migrate:dev       # creates the Account/Installation tables
npm run dev
```

- `npm run dev` — start the Next.js dev server
- `npm test` — run the Vitest suite
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run build` / `npm start` — compile and run the production build

## GitHub OAuth + App install flow (issue #61)

Two separate GitHub concepts, both required:

1. **GitHub OAuth App** — establishes who's logged into the dashboard. Register one under
   your GitHub account/org's Developer settings, with an Authorization callback URL of
   `$DASHBOARD_BASE_URL/api/auth/github/callback`. Client ID/secret go in
   `GITHUB_OAUTH_CLIENT_ID`/`GITHUB_OAUTH_CLIENT_SECRET`.
2. **The CARF GitHub App** — the same App `core-api` already uses for webhooks and
   installation tokens (see `core-api/README.md`/`core-api/.env.example`). Its "Setup URL
   (optional)" must point at `$DASHBOARD_BASE_URL/api/github-app/install/callback` (with
   "Redirect on update" enabled) so a fresh install lands back in the dashboard with an
   `installation_id`. `GITHUB_APP_SLUG`/`GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY` go in env.

Flow, end to end:

- `GET /login` → "Sign in with GitHub" → `GET /api/auth/github/start` redirects to
  GitHub's OAuth authorize page (state nonce stashed in a short-lived cookie for CSRF
  protection) → GitHub redirects back to `GET /api/auth/github/callback`, which exchanges
  the `code` for an access token, fetches the GitHub user, upserts an `Account` row, and
  sets a signed session cookie.
- `GET /dashboard` (session-protected) → "Install the CARF GitHub App" →
  `GET /api/github-app/install/start` redirects to
  `https://github.com/apps/<slug>/installations/new` (same state-nonce CSRF pattern) →
  GitHub redirects back to `GET /api/github-app/install/callback` with the new
  `installation_id`, which the route looks up via the GitHub App's own JWT (no installation
  token needed for this call) and links to the logged-in `Account` as an `Installation` row.

`prisma/schema.prisma`'s `Account`/`Installation` models are this package's own tables
(sharable Postgres instance with `core-api`, no table-name collisions) -- see
`src/lib/accountService.ts` for the persistence logic and `src/adapters/github/` for the
GitHub API clients (both unit-tested against fakes, no real network/DB in tests).

## Mode + adapter configuration (issue #62)

`/dashboard/config/[installationId]` -- a form for Augment/Standalone mode and, for
Standalone, an adapter kind + target. Saving doesn't write to any dashboard-owned
database: it mints a fresh installation access token (the App's own JWT, same pattern as
the install-flow callback), reads the target repo's current `.carf.yml` via GitHub's
Contents API (if any), merges the mode/adapter patch in with
`src/lib/carfConfigWriter.ts` (every other section -- `classification`, `threshold` --
passes through untouched), and commits the result back via the same Contents API. The
commit is authored as the CARF GitHub App itself, not the logged-in user -- there's no
user PAT anywhere in this flow.

An installation covering more than one repo shows a picker first (`GET
/installation/repositories`, installation-token auth) before the form. `.carf.yml`'s
schema is mirrored (not imported -- see `src/lib/carfConfigSchema.ts`'s doc comment) in
`AdapterConfigSchema`/`ModeSchema`; `LIVE_ADAPTER_KINDS` is deliberately kept in sync with
`webhookOrchestrator.ts`'s actual wiring, not just its schema validation, per #62's "avoid
offering an adapter that silently no-ops" acceptance criterion -- see issue #50's history
of exactly that gap.

## Classification + threshold configuration (issue #63)

`/dashboard/config/[installationId]/rules` -- a form over `.carf.yml`'s
`classification.rules` and `threshold` sections, with a live YAML preview and client-side
validation (mirrors `ClassificationSchema`/`ThresholdSchema` from
`src/lib/carfConfigSchema.ts`, the same hand-mirrored schema #62 introduced). Reuses #62's
save infrastructure exactly: mint an installation token, read the repo's current
`.carf.yml`, merge the patch in with `src/lib/carfConfigWriter.ts`'s
`applyClassificationThresholdPatch` (leaves `mode`/`adapter` untouched, the reverse of
#62's function), commit back via the Contents API.

Unlike #62's plain HTML form, this page is a client component (`RulesForm.tsx`) -- the
rule list is dynamic (add/remove rows) and the live preview has to re-render on every
keystroke, neither of which a server-rendered form can do. It POSTs JSON to
`/api/config/save-rules` rather than submitting a form; that route re-validates
server-side regardless of what the client already checked (client-side validation is a UX
nicety, never a substitute).

**Not yet built** (later dashboard issues): live status/threshold view (#64), and the
authenticated cross-service call into core-api's dashboard-facing endpoints that #65's
multi-tenant auth mechanism (now implemented, see `core-api/README.md`) makes possible.
