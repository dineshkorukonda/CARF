# web

CARF's marketing/docs site: landing page, `/docs`, and `/paper` (the threshold-engine
mathematical spec). Next.js 16 (App Router, Turbopack) + Tailwind CSS 4 + shadcn/base-ui
components. Standalone package — own `bun.lock`, no root workspace, same pattern
`core-api/` uses.

## Setup

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `bun run dev` — start the dev server (Turbopack)
- `bun run build` / `bun run start` — production build and serve
- `bun run lint` — ESLint (`eslint-config-next` core-web-vitals + TypeScript)

## Structure

```
web/
  src/
    app/            # routes: / (landing), /docs, /paper
    components/      # section components + shadcn ui/ primitives
    lib/
  public/
```
