# Per-Project View, Commit Graphs & Integrations Hub Design Spec

**Date:** 2026-09-20  
**Status:** Approved  
**Target:** `dashboard` and `core-api`

---

## 1. Problem Statement & Motivation
1. **Onboarding & Explainer Clutter**: Currently, components like `OnboardingChecklist`, `TabExplainerBanner`, and `StackRecognitionBanner` remain persistently visible across the dashboard and status pages, even after a project is fully configured and operational. This clutters the UI and obscures actual operational telemetry.
2. **Lack of Dedicated Per-Project Context**: While multiple repositories can belong to a GitHub installation, viewing a project requires filtering through global views rather than enjoying a focused, dedicated project workspace.
3. **Missing Commit Graphs & Deep Visual Telemetry**: Commits currently display only flat textual values for thresholds and windows. Developers lack visual insight into AST risk breakdowns, dynamic tolerance ceilings vs. observed error rates, soak window progress, and historical risk trends.
4. **Missing Integrations Hub**: Users configuring CARF need clear, native connection pathways for external platforms (Vercel, Render, PM2, Docker Compose, Kubernetes/Argo Rollouts, Prometheus, etc.).

---

## 2. Architecture & Design

### 2.1 Clutter-Free Configured State
- **Rule**: If a repository is protected/configured (`isProtected === true`, or `.carf.yml` exists, or commits have been evaluated by CARF):
  - `OnboardingChecklist`: Hidden by default.
  - `TabExplainerBanner`: Hidden by default.
  - `StackRecognitionBanner`: Hidden by default.
  - A compact `Help & Setup Guide` button/modal remains available in the header without consuming screen space.
- If the repository is **unconfigured**:
  - The guided setup banners remain visible to assist the initial configuration.

### 2.2 Dedicated Project View & Navigation
- Selecting a project opens its dedicated project workspace:
  - Header: Breadcrumb (`@org / <project>`), default branch, active deployment adapter badge (PM2, Docker, K8s, Augment), and live watchdog indicator.
  - Project Tabs:
    - **Live Commits & Telemetry**
    - **Deployment Adapter**
    - **Threshold Rules**
    - **Rollout Analytics**
    - **Integrations** (New)
  - Seamless navigation back to the global organization view.

### 2.3 Commit Metric Graphs & Visual Telemetry
- **Commit Rollout Trendline Chart (SVG)**:
  - Multi-point timeline across recent commits comparing dynamic error budget ceiling (%) against observed error rate (%).
  - Markers for clean rollouts (green), auto-rollbacks (red), and active observation windows (amber).
- **Per-Commit Detailed Telemetry Drawer / Card**:
  - **AST Risk Breakdown Bar**: Visual decomposition of AST risk weights (`infra`, `data`, `dependency`, `config`, `code`, `complexity`).
  - **Error Budget vs. Observed Error Gauge**: Visual comparison bar showing dynamic threshold ceiling vs observed error rate.
  - **Soak Window Progress Ring / Timeline**: Visual progress indicator showing duration and remaining watchdog soak time.
  - **Deployment Action Telemetry**: Standalone rollback command preview and execution logs.

### 2.4 New Integrations Tab (`/dashboard/integrations/[installationId]`)
- A dedicated platform connection hub:
  - **Vercel**: Next.js / Vercel frontend deployments with GitHub Actions verification step and deploy webhook hook.
  - **Render / Railway / Fly.io**: Webhook endpoints and deploy hooks that query CARF before promoting rollouts.
  - **Node.js + PM2 (VPS / Bare Metal)**: Live PM2 adapter status, ecosystem cluster generator, and zero-downtime reload script.
  - **Docker Compose & Swarm**: Automated rollback tag management (`IMAGE_TAG=$PREV_SHA docker compose up -d`).
  - **Kubernetes / Argo Rollouts / Flagger**: Native `AnalysisTemplate` YAML manifests for querying `/v1/threshold` and autonomous canary rollback.
  - **Observability Providers**: Prometheus `/metrics` exporter URL, Datadog / CloudWatch / Sentry webhook alerts.
- Features per integration card:
  - Auto-detection indicator based on repository files.
  - One-click copy for `.carf.yml`, cURL probes, and webhook endpoints.
  - Connection health check probe.

---

## 3. Testing & Verification
- Unit & component tests verifying conditional rendering of onboarding banners.
- Verification of SVG chart rendering with various commit data shapes.
- Type check (`npm run typecheck`) and build verification (`npm run build`).
