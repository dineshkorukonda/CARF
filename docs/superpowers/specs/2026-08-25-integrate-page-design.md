# `/integrate` page: adopter onboarding + live connectivity check — design

Status: approved for planning

## 1. Problem

A visitor who wants to run CARF has to deploy `core-api` themselves and wire
up a GitHub App (see `core-api/README.md` and `core-api/src/adapters/github/README.md`).
There's no single place to confirm the result actually worked, and the
landing page's "Project Status" block (CARF's own build progress) is
duplicated nowhere else, even though it's useful context on an onboarding
page too.

`GET /v1/github/status` (added alongside this) already reports whether a
running core-api instance's GitHub App credentials are valid and where it's
installed. Nothing in `web/` surfaces it.

## 2. Scope

**In scope:**
- A new page, `web/src/app/integrate/page.tsx` (route `/integrate`):
  a static 4-step checklist (deploy → create GitHub App → install → connected),
  a core-api URL input (persisted to `localStorage`), a live check against
  that URL's `/v1/github/status`, and the existing Phase 1/2/3 project-status
  block extracted into a shared component and reused here.
- A link from the landing page (`web/src/app/page.tsx`) to `/integrate`.
- `core-api`: `Access-Control-Allow-Origin: *` on `GET /v1/github/status`
  only, since it must be callable cross-origin from `carf`'s web domain
  against an arbitrary adopter-hosted instance. No other route's CORS
  behavior changes.

**Explicitly out of scope:**
- Verifying steps 1–3 (deploy, create App, install) remotely — only
  "connected" is checkable via the existing endpoint. No new core-api
  endpoints beyond the CORS header change.
- Any server-side proxy in `web/` — the browser calls the adopter's core-api
  URL directly.
- Multi-instance history, saved lists of past URLs, or any backend storage —
  `localStorage` only, single URL.
- Automated tests — `web/` has no test framework today; verified manually
  via `npm run dev`.

## 3. Design

### 3.1 `core-api` change

`src/routes/githubStatus.ts`'s handler adds one response header:
`Access-Control-Allow-Origin: *`. This is a simple cross-origin `GET` with
no custom request headers or credentials, so browsers don't preflight it —
no `OPTIONS` handler needed. Scoped to this route only; `/webhooks/github`
and `/v1/threshold` are untouched.

### 3.2 `ProjectStatus` component

Extract the Phase 1/2/3 array + rendering currently inline in
`web/src/app/page.tsx` (lines ~89–140) into `web/src/components/ProjectStatus.tsx`,
taking no props (the phase data stays hardcoded, same as today — this is a
refactor, not a new data source). `page.tsx` renders `<ProjectStatus />` in
place of the extracted JSX; `/integrate` renders the same component.

### 3.3 `/integrate` page

Client component (`"use client"`, matching `page.tsx`'s existing pattern).

- **Checklist**: an ordered list of 4 static strings for steps 1–3, plus a
  4th item ("Confirmed connected") whose checked state is driven by the live
  check's result (`connected === true`) rather than being independently
  clickable.
- **URL input**: controlled input, initialized from
  `localStorage.getItem("carf.coreApiUrl")` on mount, written back on change.
  Guarded with try/catch per the artifact/browser-storage convention (not
  strictly needed outside an artifact sandbox, but cheap insurance against
  privacy-mode `localStorage` throwing).
- **Check connection button**: validates the input is a well-formed
  `https://` URL before attempting anything (inline error otherwise, no
  fetch). On submit: `fetch(`${url}/v1/github/status`, { signal:
  AbortSignal.timeout(8000) })`.
  - Network error / abort / non-2xx / non-JSON → generic state: "Couldn't
    reach that URL — check it's correct and running."
  - `200 { connected: true, installationCount, installations }` → green
    card, "Connected · N installation(s)", listing each `installation.account`.
  - `200 { connected: false, error }` → red card showing the `error` string
    verbatim (it's already a human-readable message from `githubStatus.ts`,
    e.g. "Bad credentials" or the missing-env-var message).
- **Project status section**: `<ProjectStatus />` below the checker, under a
  heading distinguishing it from the adopter's own setup ("CARF's own build
  progress" or similar copy).

### 3.4 Data flow

Browser (on `carf`'s domain) → adopter's own core-api instance (arbitrary
origin, over HTTPS) → GitHub's API (server-side, inside core-api). No
secrets pass through the `web/` app or its origin; the response body is
limited to what `/v1/github/status` already returns (a boolean, a count,
and installation account logins).

## 4. Testing

No automated tests (no framework in `web/`). Manual verification:
1. `core-api`: existing `githubStatus.test.ts` gains a case asserting the
   CORS header is present on the response.
2. `web/`: `npm run dev`, visit `/integrate`, verify the checklist renders,
   URL persists across a reload, and the live check works against the
   already-deployed `https://carf-8jdg.onrender.com` instance (both a
   correct case and, if convenient, deliberately truncating the URL to
   confirm the unreachable-URL error path).
