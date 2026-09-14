# Unified Overview Dashboard & Pipeline Stage Tracker Design

Status: Proposed & Approved by User

## 1. Problem
Currently, the CARF dashboard suffers from several UX and architectural mismatches:
1. When logging in or navigating to `/dashboard`, the page performs a blind redirect to `/dashboard/status/[installationId]`, leaving the user with no high-level cross-project overview.
2. The user manages a single GitHub account (`@dineshkorukonda`) with 41 protected repositories, yet the UI surfaces multi-tenant "Installation Switcher" dropdowns and refers to "Installations" rather than "Integrations".
3. The commit status view displays a raw data table with no sense of active observation, lifecycle stages, or real-time progression.
4. There is no mechanism within the dashboard to sync or refresh newly added repositories from GitHub without re-running the installation flow.
5. The UI has mixed dark/dim gray tones rather than a crisp, high-readability plain white aesthetic.

## 2. Scope

**In Scope:**
- **Primary Overview Dashboard (`/dashboard/page.tsx`)**:
  - Top Integration summary banner (Connected GitHub account, protection status, repository count, sync action, manage on GitHub link).
  - Cross-project metric cards: Total Rollouts Monitored, In-Flight Active Watchdogs, Automated Rollbacks Prevented, Average Dynamic Error Budget.
  - Connected Repositories Grid: Searchable list of all repositories granted to CARF, with default branch, last analyzed commit, and 1-click jump to status/rules.
  - Global Recent Rollouts feed powered by the new **Pipeline Stage Tracker** component.
- **Pipeline Stage Tracker Component (`PipelineStageTracker.tsx`)**:
  - Horizontal 5-stage progression card: `Ingested` $\rightarrow$ `AST Classification` $\rightarrow$ `Budget Set` $\rightarrow$ `Watchdog Timer` $\rightarrow$ `Verdict`.
  - Real-time client countdown timer for in-flight observation windows (`finalWindow` countdown with progress bar).
  - Expandable detail view showing the exact sensitivity math and AST delta breakdown.
  - Segmented control on the status page allowing users to toggle between `[ ☵ Pipeline View ]` (default) and `[ ☰ Compact Table ]`.
- **Repository Sync API (`/api/integration/sync`)**:
  - Mints an installation token and calls GitHub's `GET /installation/repositories` to fetch all available repos and refresh local state.
- **Terminology & Navigation Simplification**:
  - Rename all user-facing instances of "Installation" to **"Integration"** (e.g. "GitHub Integration").
  - Remove multi-installation switcher dropdowns; pin the active integration directly in the sidebar/topbar.
- **Clean Plain White Theme**:
  - Pure white `#ffffff` surface cards, subtle `#e5e7eb` borders, sharp slate typography, vibrant status indicators (emerald green, amber, rose).
  - Remove dark mode toggles or dim gray backgrounds.

**Out of Scope:**
- Modifying `core-api` backend models or schemas (all changes leverage existing Fastify endpoints and Neon DB models).
- Multi-organization tenant switching (the platform is focused on the single user GitHub account).

## 3. Architecture & Design

### 3.1 Primary Overview Page (`/dashboard/page.tsx`)
Instead of `redirect("/dashboard/status/...")`, the overview route renders:
1. **Integration Status Banner**:
   - Displays avatar, `@dineshkorukonda`, `🟢 Active & Protected`, `41 Repositories`.
   - Includes `<RefreshReposButton />` triggering `/api/integration/sync`.
2. **Metrics Grid (4 key cards)**:
   - `Total Commits Analyzed`: Count of all processed commits across all repos.
   - `Active Watchdogs`: Commits currently inside their dynamic observation window.
   - `Outages Prevented`: Count of automated rollbacks triggered by CARF.
   - `Average Error Budget`: Mean threshold ceiling (e.g. `2.4%`).
3. **Repository Directory Grid**:
   - Filter/search input to find repos quickly among the 41.
   - Each card displays repo name, privacy, last commit, and quick links to status and `.carf.yml` config.
4. **Live Rollouts Pipeline Feed**:
   - Displays recent commits across all projects using the new `PipelineStageTracker` cards.

### 3.2 Repository Sync Route (`dashboard/src/app/api/integration/sync/route.ts`)
- Authenticates the current user account via session cookie.
- Resolves the account's primary GitHub Integration (`installationId`).
- Signs an App JWT using `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`.
- Mints an installation token via `https://api.github.com/app/installations/{installationId}/access_tokens`.
- Calls `GET /installation/repositories` to retrieve the complete up-to-date repository list.
- Returns `{ success: true, count: repos.length, repositories: repos }`.

### 3.3 Pipeline Stage Tracker (`PipelineStageTracker.tsx`)
A unified visual card for every rollout:
1. **Header**: Repo slug, commit message/SHA with copy button, author, relative time.
2. **5 Horizontal Stages**:
   - **Stage 1 (Webhook Ingestion)**: Completed timestamp.
   - **Stage 2 (AST Classification)**: Badges for languages touched (`TypeScript`, `Go`, etc.), tier-1 distribution, tier-2 churn score.
   - **Stage 3 (Dynamic Threshold)**: Calculated error budget ceiling (e.g. `1.8%`) & observation duration (e.g. `300s`).
   - **Stage 4 (Observation Watchdog)**:
     - If active: Animated progress bar counting down remaining seconds (`⏱️ 142s left`) with current error rate.
     - If finished: Total observed duration and peak error rate.
   - **Stage 5 (Verdict)**:
     - `🟢 Monitored Clean`: Error rate remained safely below budget.
     - `⚠️ Rollback Executed`: Error rate breached budget; CARF autonomous rollback triggered.
     - `⏱️ In Observation`: Currently being watched.
3. **Accordion Details (expand on click)**:
   - Visual breakdown of the Change Vector.
   - Formula justification: `Base Budget - Sensitivity Penalties = Final Threshold`.

### 3.4 Plain White Aesthetic
- Surface: `#ffffff` for all cards and panels.
- Page background: `#f8fafc` (crisp slate-50).
- Borders: `#e2e8f0` (slate-200).
- Text: Primary `#0f172a` (slate-900), secondary `#64748b` (slate-500).
- Accents:
  - Success/Safe: Emerald-600 (`#059669`) / bg-emerald-50.
  - Warning/Observation: Amber-600 (`#d97706`) / bg-amber-50.
  - Danger/Rollback: Rose-600 (`#e11d48`) / bg-rose-50.

## 4. Verification Plan
1. **Automated Verification**:
   - Run `npm run typecheck` in `dashboard` to guarantee TypeScript types match.
   - Run `npm run build` in `dashboard` to verify clean Next.js bundle compilation.
2. **Live Functional Testing**:
   - Navigate to `/dashboard` $\rightarrow$ verify Overview renders with metrics and 41 repositories.
   - Click `[ 🔄 Sync / Refresh Repositories ]` $\rightarrow$ verify it queries GitHub and updates repos without errors.
   - Navigate to `/dashboard/status/[installationId]` $\rightarrow$ verify both Pipeline View and Table View toggle smoothly.
   - Deploy to server and verify over HTTPS at `https://carf.indevs.in/dashboard`.
