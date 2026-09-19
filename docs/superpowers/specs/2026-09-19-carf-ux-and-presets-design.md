# CARF — UX, Deep Metrics, Guided Onboarding & Cloud Presets Design Spec

## 1. Overview & Problem Statement

Users integrating repositories into CARF (such as self-hosted PM2 apps or hosted apps on Vercel/Render) currently face three key UX challenges:
1. **Unclear Setup Flows & Guidance**: Users are unsure why their repositories default to "Augment Mode", what each dashboard tab does, or how to connect CARF to their specific runtime (PM2, Vercel, Render, Docker).
2. **Opaque Commit Metrics**: The Live Status table displays numbers (e.g. `3.47%`, `450s`), but lacks an interactive, plain-English breakdown explaining *why* that specific threshold was computed, what Tree-sitter AST found in the diff, and which files contributed to the risk score.
3. **Lack of Modern Cloud Platform Presets**: Platforms like Vercel and Render require lightweight advisory workflows (PR risk checks and dashboard alert banners) rather than heavy cluster rollback daemons.

---

## 2. Core Architectural Pillars

```
                               ┌─────────────────────────────────────────┐
                               │           CARF Enhanced UX Hub          │
                               └────────────────────┬────────────────────┘
                                                    │
         ┌──────────────────────────┬───────────────┴───────────────┬──────────────────────────┐
         ▼                          ▼                               ▼                          ▼
┌──────────────────┐      ┌──────────────────┐            ┌──────────────────┐       ┌──────────────────┐
│ Interactive      │      │ Deep Commit AST  │            │ Modern Cloud     │       │ Smart Advisory & │
│ Setup Wizard     │      │ Metrics Inspector│            │ Platform Presets │       │ Dashboard Alerts │
│ - Stack Selector │      │ - Plain English  │            │ - Vercel         │       │ - Live Warning   │
│ - 1-Click .carf  │      │ - Formula Math   │            │ - Render         │       │   Banners        │
│ - Tab Tooltips   │      │ - File AST Diff  │            │ - PM2 VPS        │       │ - GitHub PR      │
│                  │      │                  │            │ - Docker / K8s   │       │   Status Badges  │
└──────────────────┘      └──────────────────┘            └──────────────────┘       └──────────────────┘
```

---

## 3. Detailed Component Specifications

### 3.1. Interactive Setup Wizard & In-App Guidance
- **Stack Selector Modal**: When viewing a repository, users can click **"Setup Guide & Integration"** to choose their exact deployment target:
  - **PM2 / Node.js VPS**
  - **Vercel (Next.js / Frontend / Serverless)**
  - **Render (Web Services / Workers)**
  - **Docker Compose / Docker Swarm**
  - **Kubernetes / Argo Rollouts**
  - **AWS Lambda / Serverless**
- **1-Click Configuration Generator**: Generates a pre-tailored `.carf.yml` and copy-pasteable deployment script (e.g., GitHub Actions workflow or bash deploy script) tailored to their selected stack.
- **Contextual Tab Tooltips**: Each navigation tab (`Live Status`, `Deployment Adapter`, `Threshold Rules`, `Rollout Analytics`) includes a clear explanatory header and expandable help accordion answering:
  - *What does this tab do?*
  - *Do I need to change anything here after integration?*

---

### 3.2. Deep Commit Risk & AST Metrics Inspector
When a user clicks on any commit row in the **Live Status** table, an interactive **Commit Detail Drawer / Modal** opens with rich, human-readable insights:

1. **Plain-English Risk Verdict**:
   - *Example (Low Risk):* `"✅ Low Risk (3.47% Tolerance) — Only 2 utility helper functions modified. No database schema or critical auth paths touched."`
   - *Example (High Risk):* `"🚨 High Risk (0.80% Tolerance) — Core database migration and 3 payment route handlers modified with high cyclomatic complexity."`
2. **Tree-sitter AST & Structural Diff Breakdown**:
   - **AST Complexity Penalty**: Displays cyclomatic complexity delta, new conditional branches added, and function signature changes.
   - **Category Breakdown**: Interactive pill badges showing file categories (`Infra: 0%`, `Database: 0%`, `Code: 85%`, `Config: 15%`).
   - **Touched File List**: List of modified files with their respective risk weights.
3. **Transparent Formula Math**:
   - Displays the exact formula in an intuitive visual card:
     $$\text{Final Threshold} = \text{Base Threshold} \times (1 - \text{Decay} \times \text{Weight}) \times (1 - \text{AST Penalty})$$

---

### 3.3. Modern Cloud Platform Presets (Vercel, Render, PM2)

#### A. Vercel Preset
- **Mode**: `augment` / `advisory`
- **Workflow**:
  - GitHub Actions queries `GET /v1/threshold?commit=$SHA`.
  - Checks Vercel deployment status / preview health.
  - Generates a GitHub PR risk check badge before merging to production.
  - Provides rollback command snippet via `vercel rollback`.

#### B. Render Preset
- **Mode**: `augment` / `advisory`
- **Workflow**:
  - Triggers deployment via Render Deploy Hook URL.
  - Polls service health and compares against CARF threshold.
  - Triggers instant rollback via Render API if error budget is exceeded.

#### C. PM2 VPS Preset
- **Mode**: `standalone` or `augment` (deploy script)
- **Workflow**:
  - Step-by-step Capistrano directory setup (`/var/www/releases/<sha>` and `/var/www/current`).
  - Zero-downtime `pm2 reload` integration.
  - Automated symlink rollback on failure.

---

### 3.4. Advisory & Smart Alert Mode
For teams who want intelligent monitoring without giving CARF automated cluster rollback permissions:
- **Dashboard Risk Alert Banner**: Highlights any active deployment that exceeds its risk budget with real-time error telemetry.
- **GitHub PR Status Comments**: Automated comments on PRs summarizing the AST risk score so developers and reviewers know the blast radius before merging.
- **Manual 1-Click Rollback Action**: Provides copyable commands or webhook triggers directly in the dashboard UI when an alert is tripped.

---

## 4. Verification Plan

1. **Unit & Component Tests**:
   - Test Commit Detail Inspector component renders all AST breakdown fields accurately.
   - Test Setup Wizard stack switching generates correct `.carf.yml` configurations for Vercel, Render, PM2, Docker, and Kubernetes.
2. **Dashboard Visual Verification**:
   - Verify all tab tooltips and explanatory banners render cleanly on mobile and desktop.
   - Verify clicking commit rows opens the deep-dive AST metrics drawer with formula explanations.
3. **End-to-End Flow Verification**:
   - Verify Vercel, Render, and PM2 sample configuration snippets with mock commit data.
