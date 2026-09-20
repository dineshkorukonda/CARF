# Per-Project View, Commit Graphs & Integrations Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a clean, clutter-free per-project view with rich SVG commit-level metric graphs (error budget vs error rate, AST risk breakdown, soak timeline) and a dedicated Integrations hub (Vercel, Render, PM2, Docker, Kubernetes, etc.), completely hiding onboarding clutter once a project is configured.

**Architecture:** Update Next.js dashboard pages to conditionally hide onboarding and guide banners when a repository is protected or has evaluated commits; implement lightweight pure-SVG chart and gauge components for commit telemetry; build a new `/dashboard/integrations/[installationId]` route with platform cards, copyable snippets, and connection testers; update sidebar and tab navigation.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS, Lucide Icons, Prisma.

**Spec:** `docs/superpowers/specs/2026-09-20-project-view-graphs-integrations-design.md`

## Global Constraints
- Do not introduce heavy runtime chart dependencies; use lightweight responsive pure-SVG and Tailwind components.
- Configured repositories must NOT display `OnboardingChecklist`, `TabExplainerBanner`, or `StackRecognitionBanner`.
- Retain backwards compatibility with existing API endpoints and URL query parameters (`?repo=...`).
- Code must pass `npm run typecheck` and `npm run build` in `dashboard`.

---

### Task 1: Conditional Banner Suppression for Configured Repositories

**Files:**
- Modify: `dashboard/src/app/dashboard/status/[installationId]/page.tsx`
- Modify: `dashboard/src/app/dashboard/config/[installationId]/page.tsx`
- Modify: `dashboard/src/app/dashboard/config/[installationId]/rules/page.tsx`
- Modify: `dashboard/src/app/dashboard/analytics/[installationId]/page.tsx`
- Modify: `dashboard/src/app/dashboard/OnboardingChecklist.tsx`

**Interfaces:**
- Consumes: `commits: RecentCommit[]`, repository protection status from `/api/repo/status` or `.carf.yml`.
- Produces: Clean header without `OnboardingChecklist`, `TabExplainerBanner`, and `StackRecognitionBanner` when `isConfigured` is true.

- [ ] **Step 1: Inspect banner rendering conditions across pages**
Verify current props passed to `OnboardingChecklist`, `TabExplainerBanner`, and `StackRecognitionBanner`.

- [ ] **Step 2: Add `isConfigured` detection to `StatusPage`**
In `dashboard/src/app/dashboard/status/[installationId]/page.tsx`, evaluate whether the repository or installation is configured (e.g. commits exist or repo protection status indicates workflow/protected). Conditionally suppress `OnboardingChecklist`, `TabExplainerBanner`, and `StackRecognitionBanner`.

- [ ] **Step 3: Update `ConfigPage`, `RulesPage`, and `AnalyticsPage` to suppress redundant banners**
Wrap `TabExplainerBanner` in an optional collapsible or dismissible state or suppress when configuration is already present.

- [ ] **Step 4: Run typecheck to verify banner suppression changes**
Run: `npm --prefix dashboard run typecheck`
Expected: PASS

---

### Task 2: Build SVG Commit Metric & Trendline Visualization Components

**Files:**
- Create: `dashboard/src/components/telemetry/CommitTrendChart.tsx`
- Create: `dashboard/src/components/telemetry/CommitMetricGauges.tsx`
- Create: `dashboard/src/components/telemetry/AstRiskBreakdownBar.tsx`

**Interfaces:**
- Consumes: `RecentCommit`, `finalThreshold`, `finalWindow`, `activeTypes`, `finalErrorRate`, `rolledBack`.
- Produces: Pure SVG trendline graph, budget-vs-actual gauge, and stacked AST risk category bar.

- [ ] **Step 1: Implement `AstRiskBreakdownBar.tsx`**
Create a component that renders a weighted horizontal visual bar showing the relative contribution of `infra`, `data`, `dependency`, `config`, and `code`.

- [ ] **Step 2: Implement `CommitMetricGauges.tsx`**
Create a component that renders:
1. Dynamic error budget ceiling vs observed error rate bar gauge with threshold marker.
2. Soak observation window progress timeline.

- [ ] **Step 3: Implement `CommitTrendChart.tsx`**
Create a responsive SVG line/scatter chart taking recent commits and plotting:
1. Dynamic error budget ceiling line across commits.
2. Actual observed error rate points/bars.
3. Outcome status dots (Clean = emerald, Rolled Back = rose, In Observation = amber).

- [ ] **Step 4: Run typecheck on new components**
Run: `npm --prefix dashboard run typecheck`
Expected: PASS

---

### Task 3: Integrate Commit Metric Graphs into Project View & Inspector Drawer

**Files:**
- Modify: `dashboard/src/app/dashboard/status/[installationId]/StatusTable.tsx`
- Modify: `dashboard/src/app/dashboard/status/[installationId]/CommitRiskInspectorDrawer.tsx`

**Interfaces:**
- Consumes: `CommitTrendChart`, `CommitMetricGauges`, `AstRiskBreakdownBar`.
- Produces: Dedicated project header with trendline graph and rich drawer visual telemetry.

- [ ] **Step 1: Add `CommitTrendChart` to single-project view in `StatusTable.tsx`**
When `selectedRepoFilter !== "all"`, render the `CommitTrendChart` above the commits table showing the project's recent rollouts.

- [ ] **Step 2: Upgrade `CommitRiskInspectorDrawer.tsx` with visual gauges**
Replace static text in `CommitRiskInspectorDrawer` with `AstRiskBreakdownBar`, `CommitMetricGauges`, and soak progress timeline.

- [ ] **Step 3: Run typecheck to verify integration**
Run: `npm --prefix dashboard run typecheck`
Expected: PASS

---

### Task 4: Build the Dedicated Integrations Hub Tab

**Files:**
- Create: `dashboard/src/app/dashboard/integrations/[installationId]/page.tsx`
- Create: `dashboard/src/app/dashboard/integrations/[installationId]/IntegrationsView.tsx`
- Modify: `dashboard/src/app/dashboard/RepoNavigationTabs.tsx`
- Modify: `dashboard/src/app/dashboard/SidebarShell.tsx`

**Interfaces:**
- Consumes: `installationId`, `repoName`, detected stack heuristics from `stackDetector.ts`.
- Produces: Dedicated Integrations page supporting Vercel, Render, PM2, Docker, Kubernetes/Argo, and Prometheus.

- [ ] **Step 1: Create `IntegrationsView.tsx` with platform integration cards**
Implement interactive integration cards for:
- Vercel (Next.js / Frontend deploy webhook + GitHub Actions check)
- Render & Railway (Deploy hook + threshold query)
- Node.js + PM2 (Ecosystem cluster config generator + zero downtime reload)
- Docker Compose & Swarm (Image tag swap rollback)
- Kubernetes & Argo Rollouts (AnalysisTemplate YAML snippet)
- Prometheus & Observability (/metrics endpoint probe)
Include one-click copy, detected stack badges, and configuration test probes.

- [ ] **Step 2: Create server page `dashboard/src/app/dashboard/integrations/[installationId]/page.tsx`**
Authenticate account, fetch installation and repository info, and render `IntegrationsView`.

- [ ] **Step 3: Add `Integrations` tab to `RepoNavigationTabs.tsx` and `SidebarShell.tsx`**
Add the `Plug` / `Blocks` icon with link `/dashboard/integrations/${installationId}`.

- [ ] **Step 4: Run typecheck to verify navigation and integrations page**
Run: `npm --prefix dashboard run typecheck`
Expected: PASS

---

### Task 5: End-to-End Verification & Build Check

**Files:**
- All modified files

- [ ] **Step 1: Run linter and typecheck**
Run: `npm --prefix dashboard run lint` and `npm --prefix dashboard run typecheck`
Expected: Zero errors.

- [ ] **Step 2: Run dashboard production build**
Run: `npm --prefix dashboard run build`
Expected: Build succeeds with all routes compiled.

- [ ] **Step 3: Verify clean configured state and navigation in UI**
Confirm that configured repositories do not display onboarding banners, display commit graphs, and provide the new Integrations tab.
