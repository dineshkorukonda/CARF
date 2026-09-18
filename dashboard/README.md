# CARF Dashboard
 
Team-facing dashboard for onboarding onto CARF: sign in with GitHub via Auth.js, install the CARF
GitHub App on your repository or organization, configure mode/adapter, classification, and
threshold rules, and view live rollback status.
 
## Setup

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # fill in real values, see instructions below
npm run db:generate
npm run db:migrate:dev       # applies Auth.js and Installation migrations
npm run dev
```

- `npm run dev` — start the Next.js dev server (default `http://localhost:3000`)
- `npm test` — run the Vitest suite
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run build` / `npm start` — compile and run the production build
- `npm run db:migrate:deploy` — apply migrations against a prod database (no prompts)
 
---

## GitHub App Configuration Guide

The dashboard uses the same CARF GitHub App for both **User Authentication (OAuth via Auth.js)** and **Repository Access / Installations**.

### 1. General App Settings
In GitHub -> **Settings** -> **Developer Settings** -> **GitHub Apps** -> Select your CARF App:

1. **Client Credentials**:
   - Copy **Client ID** -> set as `AUTH_GITHUB_ID`.
   - Click **Generate a new client secret** -> copy the secret -> set as `AUTH_GITHUB_SECRET`.
2. **User Authorization (OAuth)**:
   - Check/enable: **"Request user authorization (OAuth) during installation"**.
   - **Callback URL**:
     - Local Dev: `http://localhost:3000/api/auth/callback/github`
     - Production: `https://dashboard.carf.indevs.in/api/auth/callback/github`
     *(If registering multiple environments under one app or testing locally, ensure the active dashboard origin matches the registered callback).*
   - **Expire user authorization tokens**: Optional (standard Auth.js flow uses the OAuth identity).
3. **App Installation URLs**:
   - **Setup URL (optional)**:
     - Local Dev: `http://localhost:3000/api/github-app/install/callback`
     - Production: `https://dashboard.carf.indevs.in/api/github-app/install/callback`
   - Check/enable: **"Redirect on update"**.
4. **App Identification & Private Key**:
   - Copy **App ID** -> set as `GITHUB_APP_ID`.
   - Copy App slug -> set as `GITHUB_APP_SLUG` (e.g. `carf-cp`).
   - Generate a private key (`.pem`) -> set base64 / PEM string as `GITHUB_APP_PRIVATE_KEY`.

### 2. Permissions & Events
Ensure your GitHub App has:
- **Repository permissions**:
  - `Contents: Read and write` (to commit `.carf.yml` configuration updates)
  - `Metadata: Read-only` (default)
  - `Commit statuses: Read and write` / `Deployments: Read and write` (for core-api rollback operations)
- **Account permissions**:
  - `Email addresses: Read-only` (allows GitHub OAuth to fetch primary verified email)
- **Subscribe to events**:
  - `Installation`, `Installation target`, `Push`, `Status`, `Deployment status`

---

## Environment Variables

| Variable | Description | Example / Notes |
| :--- | :--- | :--- |
| `DASHBOARD_BASE_URL` | Public origin of the dashboard | `http://localhost:3000` (dev) / `https://dashboard.carf.indevs.in` (prod) |
| `DATABASE_URL` | Neon pooled connection string | `postgresql://user:pass@ep-...-pooler.neon.tech/carf_dashboard?sslmode=require` |
| `DIRECT_URL` | Neon unpooled connection string (for migrations) | `postgresql://user:pass@ep-...neon.tech/carf_dashboard?sslmode=require` |
| `AUTH_SECRET` | NextAuth v5 session secret | Generate via `openssl rand -hex 32` or `npx auth secret` |
| `AUTH_GITHUB_ID` | GitHub App Client ID | From GitHub App Settings |
| `AUTH_GITHUB_SECRET` | GitHub App Client Secret | From GitHub App Settings |
| `GITHUB_APP_SLUG` | GitHub App Slug | e.g. `carf-cp` |
| `GITHUB_APP_ID` | GitHub App ID | e.g. `123456` |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App Private Key | `-----BEGIN RSA PRIVATE KEY-----\n...` |
| `CORE_API_BASE_URL` | Base URL of CARF Core API | `http://localhost:3001` (dev) / `https://api.carf.indevs.in` (prod) |

---

## Authentication & Installation Architecture

1. **Authentication (Auth.js v5 + GitHub Provider)**:
   - Eliminates custom password hashing, reset tokens, and verification flows.
   - Powered by NextAuth v5 (`@auth/prisma-adapter`) using GitHub provider.
   - User sessions and accounts are backed by Prisma `User` and `Account` models.
   - Existing users are linked seamlessly by email (`allowDangerousEmailAccountLinking: true`). A dry-run migration script is provided at `scripts/link-existing-users.mjs`.
   - Numeric GitHub ID is extracted from `Account.providerAccountId` and preserved in session context.
2. **Middleware Route Protection**:
   - `src/middleware.ts` guards all private `/dashboard/*` and `/api/config/*` routes while permitting public assets and auth endpoints (`/login`, `/api/auth/*`).
3. **Installation Linking**:
   - Authenticated users install the GitHub App via `GET /api/github-app/install/start` (with CSRF cookie).
   - GitHub returns to `GET /api/github-app/install/callback` with `installation_id`.
   - The dashboard mints a GitHub App JWT, verifies installation metadata, and links the installation to `userId`.
   - Installation records prevent cross-account hijacking via ownership verification in `accountService.ts`.

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

## Live status view (issue #64)

`/dashboard/status/[installationId]` -- the first dashboard screen that calls core-api
directly rather than only committing to `.carf.yml`. Shows a polling (every 15s) table of
the installation's recent commits: classification types, computed threshold/window, and
rollout outcome once available, via core-api's `GET /v1/commits` (see
`core-api/README.md`'s equivalent section).

**How the dashboard authenticates to core-api:** core-api's `installationId`-scoped data
is gated by a per-installation API key (#65) that core-api only ever logs once, server-side
-- the dashboard was never handed it. `src/lib/coreApiAccess.ts`'s `ensureCoreApiKey`
closes that gap: the first time an installation's status view is loaded, it signs a GitHub
App JWT (same private key core-api holds -- see `.env.example`) and calls core-api's
`GET /v1/installations/:installationId/api-key`, which treats a valid App JWT as proof of
control and hands back a **freshly rotated** key (the old one, if any, stops working). The
key is cached on the `Installation` row (`prisma/schema.prisma`'s `coreApiKey` field) so
this round trip only happens once per installation, not on every poll.

The polling itself goes through this dashboard's own `/api/status/[installationId]` route,
not straight from the browser to core-api -- the cached core-api key never needs to reach
client-side JavaScript. `StatusTable.tsx` is a small client component (`setInterval` +
`fetch`); "live push" is explicitly deferred (#64's acceptance criteria call out polling as
an acceptable first cut).

**Not yet built:** everything past what issues #61-#65 scoped -- e.g. installation-level
settings beyond mode/adapter/classification/threshold, or acting on rollout outcomes from
the dashboard itself.
