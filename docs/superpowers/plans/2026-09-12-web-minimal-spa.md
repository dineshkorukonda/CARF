# Minimal CARF Showcase SPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip down the existing heavy Next.js application in `/web` and replace it with an ultra-minimal Vite + React + TypeScript + Tailwind CSS single-screen showcase that highlights CARF framework concepts and links directly to hosted auth and dashboard services.

**Architecture:** A single-page client app built with Vite and React 19. The layout is optimized to fit a single viewport with a minimalist light aesthetic (paper white `#ffffff`/`#fafafa`, crisp borders `#eaeaea`, serif headlines, mono accents), presenting CARF's core mechanics and directing users to `dashboard.carf.indevs.in`.

**Tech Stack:** Vite 6+, React 19, TypeScript 5+, Tailwind CSS 4+, Lucide React, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-12-web-minimal-spa-design.md`

## Global Constraints

- Tech stack must be Vite + React + TypeScript SPA in `/web`.
- Theme must be light minimalist (Thinking Machines style: white background `#ffffff`, subtle borders `#eaeaea`, dark text `#0a0a0a`).
- Must link to:
  - Sign In: `https://dashboard.carf.indevs.in/login`
  - Sign Up / Get Started: `https://dashboard.carf.indevs.in/signup`
  - Dashboard: `https://dashboard.carf.indevs.in/dashboard`
- Must NOT include any link to paper / PDF.
- Must NOT include any link to GitHub / repository.
- Must fit cleanly in viewport without unnecessary multi-screen scrolling.
- All work performed in isolated worktree `.worktrees/web-minimal-spa` on branch `feat/web-minimal-spa`.

---

### Task 1: Clean and Scaffold Vite + React + Tailwind App in `/web`

**Files:**
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/index.css`
- Create: `web/tsconfig.json`
- Create: `web/tsconfig.node.json`
- Modify: `web/package.json`
- Delete: `web/next.config.ts`, `web/components.json`, `web/next-env.d.ts`, `web/src/app` (directory and contents), `web/src/components` (old next components)

**Interfaces:**
- Produces: Working Vite build setup in `web/` where `bun run build` / `npm run build` bundles the app into `web/dist`.

- [ ] **Step 1: Clean out Next.js legacy files and directories in `web/`**

Run shell command to delete old Next.js app directory, config, and build artifacts:
```powershell
Remove-Item -Recurse -Force web/src/app, web/src/components, web/next.config.ts, web/components.json, web/next-env.d.ts -ErrorAction SilentlyContinue
```

- [ ] **Step 2: Configure `web/package.json` for Vite + React + Tailwind + Vitest**

Write clean `web/package.json`:
```json
{
  "name": "carf-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^1.25.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.2"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@types/node": "^20.14.10",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.7.2",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 3: Create Vite & TypeScript configs**

Write `web/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
} as any);
```

Write `web/tsconfig.json` & `web/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create HTML entry point and basic index.css**

Write `web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CARF — Change-Aware Rollback Framework</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="bg-[#ffffff] text-[#0a0a0a] antialiased selection:bg-[#111] selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Write `web/src/index.css`:
```css
@import "tailwindcss";

@layer base {
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
}
```

- [ ] **Step 5: Install dependencies and verify build**

Run:
```powershell
cd web; bun install; bun run build
```
Expected: Build succeeds and outputs to `web/dist`.

- [ ] **Step 6: Commit scaffolding changes**

```bash
git add web
git commit -m "refactor(web): scaffold minimal Vite React SPA and remove Next.js artifacts"
```

---

### Task 2: Implement Single-Screen Showcase Component with Auth Links

**Files:**
- Create: `web/src/test/setup.ts`
- Create: `web/src/App.test.tsx`
- Create: `web/src/App.tsx`

**Interfaces:**
- Consumes: Tailwind styles, Lucide icons.
- Produces: Viewport-fitted single-screen showcase UI with:
  - Auth link: `https://dashboard.carf.indevs.in/login` ("Sign In")
  - Auth link: `https://dashboard.carf.indevs.in/signup` ("Get Started" / "Create Account")
  - Dashboard link: `https://dashboard.carf.indevs.in/dashboard` ("Open Dashboard")
  - Guaranteed absence of any link matching `/paper` or `github.com`.

- [ ] **Step 1: Write the failing unit tests for `App.tsx`**

Write `web/src/test/setup.ts`:
```typescript
import "@testing-library/jest-dom";
```

Write `web/src/App.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("CARF Minimal Showcase SPA", () => {
  it("renders CARF brand and headline", () => {
    render(<App />);
    expect(screen.getAllByText(/CARF/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Dynamic, risk-calibrated error tolerances/i)).toBeInTheDocument();
  });

  it("contains direct links to authentication and dashboard", () => {
    render(<App />);
    
    // Check Sign In link
    const signInLinks = screen.getAllByRole("link", { name: /sign in/i });
    expect(signInLinks.some(link => link.getAttribute("href") === "https://dashboard.carf.indevs.in/login")).toBe(true);

    // Check Sign Up / Get Started link
    const signUpLinks = screen.getAllByRole("link", { name: /get started|create account/i });
    expect(signUpLinks.some(link => link.getAttribute("href") === "https://dashboard.carf.indevs.in/signup")).toBe(true);

    // Check Dashboard link
    const dashboardLinks = screen.getAllByRole("link", { name: /open dashboard|dashboard/i });
    expect(dashboardLinks.some(link => link.getAttribute("href") === "https://dashboard.carf.indevs.in/dashboard")).toBe(true);
  });

  it("strictly omits paper and repository links", () => {
    render(<App />);
    const allLinks = screen.getAllByRole("link");
    for (const link of allLinks) {
      const href = link.getAttribute("href") || "";
      expect(href).not.toContain("github.com");
      expect(href).not.toContain("drive.google.com");
      expect(href).not.toContain("/paper");
    }
  });

  it("renders the 3 architectural pillars", () => {
    render(<App />);
    expect(screen.getByText(/Tier 1 Path Rules/i)).toBeInTheDocument();
    expect(screen.getByText(/Tier 2 Tree-Sitter AST/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-Time Canary Tuning/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
cd web; bun run test
```
Expected: FAIL because `App.tsx` has not implemented the components yet.

- [ ] **Step 3: Implement `web/src/App.tsx`**

Write `web/src/App.tsx` adhering to the clean Thinking Machines aesthetic:
- Responsive, clean viewport layout with minimal whitespace management.
- Monochromatic badge `CARF` with border `#eaeaea`, high-contrast text.
- Header with Sign In link and Get Started button.
- Hero with headline in `font-['Lora',serif]` and concise description in `font-['Inter',sans-serif]`.
- 3 cards detailing Tier 1 (Path & Manifest Classification), Tier 2 (Tree-Sitter Structural AST Parsing), and Sidecar Canary Delivery (Argo Rollouts / Flagger).
- Hero CTAs: "Open Dashboard" button, "Create Account" button.
- Footer note with copyright and clean framework status.

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
cd web; bun run test
```
Expected: PASS (4 tests passing).

- [ ] **Step 5: Commit implementation**

```bash
git add web/src
git commit -m "feat(web): implement ultra-minimal CARF showcase SPA with auth links"
```

---

### Task 3: Production Build and Final Verification

**Files:**
- Modify: `web/index.html` (add SVG favicon)
- Create: `web/public/favicon.svg`

**Interfaces:**
- Produces: Zero-error production build at `web/dist`.

- [ ] **Step 1: Add minimal SVG favicon in `web/public/favicon.svg`**

Create clean SVG icon representing CARF.

- [ ] **Step 2: Run full build and test suite**

Run:
```powershell
cd web
bun run test
bun run build
```
Expected: All tests pass, Vite build succeeds with minimal bundle size (< 150KB gzip).

- [ ] **Step 3: Commit and verify worktree status**

```bash
git add web
git commit -m "chore(web): finalize production build assets and verification"
git status
```
Expected: Clean working tree on branch `feat/web-minimal-spa`.
