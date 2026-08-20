# core-api

CARF's classification + decision engine. See `CLAUDE.md` for architecture/conventions
and `../docs/CARF_PROPOSED_IMPLEMENTATION.md` for the full design spec.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL / GitHub App credentials
npm run dev
```

## Scripts

- `npm run dev` — start the Fastify server with hot reload
- `npm test` — run the Vitest suite
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` / `npm start` — compile and run the production build
