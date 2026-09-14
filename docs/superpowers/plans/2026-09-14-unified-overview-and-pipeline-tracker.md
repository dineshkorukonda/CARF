# Unified Overview Dashboard & Pipeline Stage Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the CARF dashboard into a unified cross-project overview with a repository sync action, GitOps-style Pipeline Stage Tracker for rollouts, single-user GitHub integration scoping, and a crisp plain-white aesthetic.

**Architecture:** 
Next.js 15 App Router dashboard connecting to Neon PostgreSQL and Fastify `core-api`. Introduces an authenticated `/api/integration/sync` route for dynamic GitHub repo discovery, an Overview Command Center at `/dashboard`, a 5-stage visual `PipelineStageTracker` card component with live observation countdown timers, and streamlined navigation scoped to the single `@dineshkorukonda` integration.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, Lucide React, Prisma Client, JWT.

**Spec:** `docs/superpowers/specs/2026-09-14-unified-overview-and-pipeline-tracker-design.md`

## Global Constraints
- High-contrast Plain White Mode: Pure white cards (`#ffffff`), subtle borders (`#e2e8f0`), sharp slate typography (`#0f172a`), no dark mode toggle or murky gray containers.
- Scope: Single user GitHub integration (`@dineshkorukonda`), removing multi-tenant switcher dropdowns.
- Terminology: Rename all user-facing instances of "Installation" to "Integration".
- No breaking changes to `core-api` Fastify endpoints or database schemas.

---

### Task 1: Repository Sync Backend Route

**Files:**
- Create: `dashboard/src/app/api/integration/sync/route.ts`
- Test: `dashboard/test/api/integrationSync.test.ts` (or manual test via node script)

**Interfaces:**
- Consumes: `getCurrentAccount()` from `dashboard/src/lib/auth.ts`, `listInstallationsForAccount` from `dashboard/src/lib/accountService.ts`, `signGithubAppJwt` from `dashboard/src/adapters/github/appInstallClient.ts`, `mintInstallationToken` from `dashboard/src/adapters/github/installationTokenClient.ts`, `listInstallationRepos` from `dashboard/src/adapters/github/reposClient.ts`.
- Produces: `POST /api/integration/sync` returning `{ ok: true, count: number, repositories: InstallationRepo[] }`.

- [ ] **Step 1: Implement the repository sync route**
Create `dashboard/src/app/api/integration/sync/route.ts` to authenticate the user session, mint an installation access token, call `listInstallationRepos`, and return the fresh repository list.

- [ ] **Step 2: Verify endpoint via curl on server / local**
Verify the endpoint responds with `{ ok: true, count: 41, repositories: [...] }`.

- [ ] **Step 3: Commit**
```bash
git add dashboard/src/app/api/integration/sync/route.ts
git commit -m "feat(dashboard): add repository sync API route"
```

---

### Task 2: Repository Sync Client & Refresh Button

**Files:**
- Create: `dashboard/src/app/dashboard/RefreshReposButton.tsx`
- Modify: `dashboard/src/app/dashboard/Topbar.tsx`

**Interfaces:**
- Consumes: `/api/integration/sync` via `fetch`.
- Produces: `<RefreshReposButton />` client component with spinning refresh state and toast/status notification.

- [ ] **Step 1: Create `RefreshReposButton.tsx`**
Interactive client button with Lucide `RotateCw` or `RefreshCw`, loading state, and `router.refresh()` trigger on success.

- [ ] **Step 2: Commit**
```bash
git add dashboard/src/app/dashboard/RefreshReposButton.tsx
git commit -m "feat(dashboard): add repository refresh button component"
```

---

### Task 3: Pipeline Stage Tracker Component

**Files:**
- Create: `dashboard/src/app/dashboard/PipelineStageTracker.tsx`

**Interfaces:**
- Consumes: `RecentCommit` from `dashboard/src/adapters/coreApi/client.ts`.
- Produces: `<PipelineStageTracker commits={commits} />` component showing horizontal 5-stage progression (`Ingested`, `AST Classified`, `Budget Set`, `Observation Watchdog`, `Verdict`), live countdown progress bar, and expandable sensitivity formula accordion.

- [ ] **Step 1: Build `PipelineStageTracker.tsx`**
Implement the stage calculation:
- Stage 1: Ingested (green check with timestamp).
- Stage 2: AST Classification (language badges, churn weight).
- Stage 3: Budget Set (threshold percentage & observation seconds).
- Stage 4: Watchdog Timer (client countdown hook `useRemainingSeconds` comparing `createdAt + finalWindow` to `Date.now()`).
- Stage 5: Outcome Verdict (`Safe & Clean`, `Rollback Triggered`, or `In Observation`).
- Expandable detail view revealing ChangeVector breakdown and threshold math.

- [ ] **Step 2: Commit**
```bash
git add dashboard/src/app/dashboard/PipelineStageTracker.tsx
git commit -m "feat(dashboard): add PipelineStageTracker component"
```

---

### Task 4: Primary Overview Page (`/dashboard/page.tsx`)

**Files:**
- Modify: `dashboard/src/app/dashboard/page.tsx`
- Create: `dashboard/src/app/dashboard/OverviewView.tsx`

**Interfaces:**
- Consumes: `listInstallationsForAccount`, `fetchRecentCommits`, `listInstallationRepos`.
- Produces: Complete Command Center page replacing the redirect.

- [ ] **Step 1: Build `OverviewView.tsx`**
- Integration status banner (`@dineshkorukonda`, 41 repos, `RefreshReposButton`).
- 4 Cross-Project Metric Cards (Total Commits, Active Watchdogs, Outages Prevented, Average Error Budget).
- Searchable Repositories Grid (filter input, repo cards with branch and links to Status/Rules).
- Recent Rollouts Feed rendered with `<PipelineStageTracker />`.

- [ ] **Step 2: Update `dashboard/src/app/dashboard/page.tsx`**
Fetch data server-side and render `<OverviewView />` instead of redirecting.

- [ ] **Step 3: Commit**
```bash
git add dashboard/src/app/dashboard/page.tsx dashboard/src/app/dashboard/OverviewView.tsx
git commit -m "feat(dashboard): implement primary overview command center"
```

---

### Task 5: Status Page Upgrade with Dual-View Switcher

**Files:**
- Modify: `dashboard/src/app/dashboard/status/[installationId]/StatusTable.tsx`
- Modify: `dashboard/src/app/dashboard/status/[installationId]/page.tsx`

**Interfaces:**
- Consumes: `PipelineStageTracker`, `StatusTable`.
- Produces: Segmented view toggle (`Pipeline View` vs `Compact Table`).

- [ ] **Step 1: Add Dual-View toggle**
Add view switcher segmented control (`[ ☵ Pipeline View ]` / `[ ☰ Compact Table ]`) and integrate `PipelineStageTracker` into the Status page.

- [ ] **Step 2: Update terminology**
Replace "Installation" with "Integration" across the status header and tabs.

- [ ] **Step 3: Commit**
```bash
git add dashboard/src/app/dashboard/status/[installationId]/
git commit -m "feat(dashboard): add dual pipeline/table view and rename installation to integration"
```

---

### Task 6: Sidebar & Navigation Simplification (Single Account Scope & Plain White Theme)

**Files:**
- Modify: `dashboard/src/app/dashboard/SidebarShell.tsx`
- Modify: `dashboard/src/app/dashboard/Topbar.tsx`
- Modify: `dashboard/src/app/dashboard/RepoNavigationTabs.tsx`
- Modify: `dashboard/src/app/globals.css` (or layout background)

**Interfaces:**
- Consumes: Account & integration data.
- Produces: Clean white sidebar, single-user `@dineshkorukonda` integration pill, renamed navigation links ("Overview", "Rollout Pipeline", "Repositories", "GitHub Integration", "Analytics").

- [ ] **Step 1: Simplify Sidebar & Topbar**
Remove `InstallationSwitcher` dropdown. Show crisp `@dineshkorukonda` integration pill with repository count. Update navigation labels.

- [ ] **Step 2: Enforce Plain White Styling**
Clean `#ffffff` card backgrounds, `#f8fafc` outer background, `#e2e8f0` crisp borders.

- [ ] **Step 3: Commit**
```bash
git add dashboard/src/app/dashboard/SidebarShell.tsx dashboard/src/app/dashboard/Topbar.tsx dashboard/src/app/dashboard/RepoNavigationTabs.tsx
git commit -m "refactor(dashboard): simplify navigation to single integration scope and apply clean white theme"
```

---

### Task 7: Full Verification & Server Deployment

**Files:**
- None (Build & deployment verification)

- [ ] **Step 1: Run typecheck and build locally**
Run `npm run typecheck` and `npm run build` in `dashboard`.

- [ ] **Step 2: Deploy to Ubuntu VPS**
Push to GitHub, pull on server, run `npm run build` in `~/CARF/dashboard`, restart PM2 process `carf-dashboard`.

- [ ] **Step 3: Verify live deployment**
Test `https://carf.indevs.in/dashboard` in browser and confirm Overview, Pipeline View, Repo Sync, and White Theme.
