# Minimal CARF Showcase SPA Design Specification

## Overview
Replaces the existing heavy Next.js application in `/web` with an ultra-minimal, single-screen Vite + React + TypeScript SPA. The SPA serves as a fast, clean showcase for CARF (Change-Aware Rollback Framework) and directs users to the hosted authentication and dashboard services at `dashboard.carf.indevs.in`.

## User Constraints & Requirements
* **Tech Stack**: Vite + React 19 + TypeScript + Tailwind CSS.
* **Layout**: Ultra-minimal single screen (fits cleanly in viewport, zero extraneous scrolling, no bloated multi-page navigation).
* **Theme**: Minimalist clean light aesthetic (paper white `#ffffff` / `#fafafa`, crisp `#eaeaea` borders, dark charcoal typography, serif/sans pairing inspired by Thinking Machines aesthetic).
* **Links**:
  * Direct links to authentication and dashboard:
    * Sign In: `https://dashboard.carf.indevs.in/login`
    * Sign Up / Get Started: `https://dashboard.carf.indevs.in/signup`
    * Dashboard: `https://dashboard.carf.indevs.in/dashboard`
  * **Strict Exclusion**: NO links to research paper or PDF, and NO links to GitHub repository.
* **Isolation**: All work executed in dedicated worktree `.worktrees/web-minimal-spa` on branch `feat/web-minimal-spa`.

## Architecture & Components

### 1. Project Scaffolding (`/web`)
* Replace Next.js (`next`, `.next`, `components.json`, `app/`, etc.) with standard Vite React SPA configuration:
  * `vite.config.ts` with `@vitejs/plugin-react`
  * `index.html` (light theme metadata, clean title, font imports)
  * `package.json` with scripts: `dev`, `build`, `preview`, `lint`
  * Dependencies: `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge`
  * DevDependencies: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite` (or Tailwind PostCSS), `typescript`, `@types/react`, `@types/react-dom`
  * `tsconfig.json` & `tsconfig.node.json`

### 2. Viewport-Fitted Showcase Component Structure
* **Header / Navigation**:
  * Top bar with CARF mono badge (`CARF`) and subtitle (`Change-Aware Rollback Framework`).
  * Right-aligned auth actions:
    * "Sign In" link -> `https://dashboard.carf.indevs.in/login`
    * "Get Started" high-contrast button -> `https://dashboard.carf.indevs.in/signup`
* **Hero & Core Statement**:
  * Pill indicator: `Dynamic Canary Thresholds · AST-Calibrated Rollbacks`
  * Main Headline: Dynamic, risk-calibrated error tolerances for progressive delivery.
  * Subheading: Replaces static rollback thresholds with real-time error tolerances calculated directly from commit diffs via deterministic file classification and Tree-sitter AST structural parsing.
* **Core Technical Pillars (3 Clean Metric / Feature Blocks)**:
  1. **Tier 1 Path Rules**: Deterministic classification of infrastructure manifests, config files, and documentation.
  2. **Tier 2 Tree-Sitter AST**: Structural syntax diffing analyzing functions, parameters, and control-flow complexity.
  3. **Real-Time Canary Tuning**: Live sidecar integration feeding dynamic error budgets to Argo Rollouts and Flagger.
* **Hero Call-to-Action Bar**:
  * Primary Button: "Open Dashboard" -> `https://dashboard.carf.indevs.in/dashboard`
  * Secondary Button: "Create Account" -> `https://dashboard.carf.indevs.in/signup`
* **Footer Bar**:
  * Minimal single-line bottom bar: `CARF — Change-Aware Rollback Framework` (C) 2026.

## Verification Plan
1. Scaffolding verification: run `bun install` / `npm install` inside `/web`.
2. Build verification: run `bun run build` / `npm run build` and ensure zero errors or warnings.
3. Lint / typecheck verification: run `tsc --noEmit` and verify clean types.
4. Content check: verify all auth URLs point to `dashboard.carf.indevs.in`, and ensure no paper or repo links are present.
