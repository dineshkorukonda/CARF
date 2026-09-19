# CARF UX, Deep Metrics, Guided Onboarding & Cloud Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide clear onboarding setup flows, plain-English AST commit metrics with formula explainability, cloud presets for Vercel/Render/PM2, and advisory alert banners across 3 distinct commit phases.

**Architecture:** Enhances the CARF Dashboard UI (Next.js, Tailwind, React, Lucide) and Core API adapters/schema with interactive setup wizards, commit inspection drawers, preset templates, and advisory risk telemetry.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, TypeScript, Vitest, Fastify Core API.

**Spec:** `docs/superpowers/specs/2026-09-19-carf-ux-and-presets-design.md`

---

## Phase Breakdown (3 Commits & PR)

### Task 1: Phase 1 — In-Dashboard Setup Wizard, Guided Onboarding & Contextual Guidance
- [ ] **Step 1:** Create `SetupGuideModal.tsx` and stack selector component with presets for PM2, Vercel, Render, Docker, and Kubernetes.
- [ ] **Step 2:** Create `TabExplainerBanner.tsx` and integrate it into `Live Status`, `Deployment Adapter`, `Threshold Rules`, and `Rollout Analytics`.
- [ ] **Step 3:** Add test suite in `dashboard/test/components/SetupGuideModal.test.tsx`.
- [ ] **Step 4:** Run tests and typecheck (`npm run typecheck && npm test`).
- [ ] **Step 5:** Git commit: `feat(dashboard): add interactive setup wizard and tab guidance`.

### Task 2: Phase 2 — Deep Commit Risk AST Metrics Inspector & Explainability Drawer
- [ ] **Step 1:** Create `CommitRiskInspectorDrawer.tsx` displaying plain-English verdict, Tree-sitter AST complexity delta, modified functions list, and step-by-step formula math card.
- [ ] **Step 2:** Integrate row click / inspect action into `StatusTable.tsx`.
- [ ] **Step 3:** Add component unit tests in `dashboard/test/components/CommitRiskInspectorDrawer.test.tsx`.
- [ ] **Step 4:** Run tests and typecheck (`npm run typecheck && npm test`).
- [ ] **Step 5:** Git commit: `feat(dashboard): add deep-dive commit AST metrics inspector and formula explainability`.

### Task 3: Phase 3 — Modern Cloud Presets (Vercel, Render, PM2) & Advisory Alert Mode
- [ ] **Step 1:** Add Vercel and Render deployment guide presets and workflow generators to the `Deployment Adapter` tab.
- [ ] **Step 2:** Add `AdvisoryAlertBanner.tsx` and PR risk check badges for repositories running in advisory mode.
- [ ] **Step 3:** Add tests in `dashboard/test/components/AdvisoryAlertBanner.test.tsx`.
- [ ] **Step 4:** Run full project test suite (`npm test`).
- [ ] **Step 5:** Git commit: `feat(dashboard): add Vercel/Render/PM2 presets and advisory alert mode`.
