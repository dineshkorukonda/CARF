# CARF Database Migrations Guide

## Sole Migration Ownership
- **`core-api` is the sole migration owner** for the shared database.
- All database migrations are authored, generated, and tracked in `core-api/prisma/migrations/`.
- The `dashboard` application uses the shared database schema for read/write operations and UI state, but **the dashboard CI/CD and deployment workflows must NEVER run `prisma migrate deploy` against shared or production databases (e.g. Neon)**.

## Schema Parity Verification
- `core-api/prisma/schema.prisma` and `dashboard/prisma/schema.prisma` are maintained with identical data model definitions.
- CI runs `scripts/check-schema-parity.mjs` on every pull request and push to enforce exact parity after `prisma format` with comments stripped.
- If a schema change is needed:
  1. Update `core-api/prisma/schema.prisma`.
  2. Create a migration in `core-api`: `npx prisma migrate dev --name <migration_name>` or author in `core-api/prisma/migrations/`.
  3. Mirror the model changes to `dashboard/prisma/schema.prisma`.
  4. Run `npx prisma format` in both directories.
  5. Run `node scripts/check-schema-parity.mjs` to confirm parity.
  6. Run `npx prisma generate` in both `core-api` and `dashboard`.

## Pre-deployment Checklist for Production (Neon DB)
Before running migrations on the live production Neon database:
1. **Check `_prisma_migrations` Table**:
   Query `SELECT id, migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC;` to ensure previous migrations are completed and not in a rolled-back or pending state.
2. **Verify Migration Status**:
   From `core-api`, run:
   ```bash
   npx prisma migrate status
   ```
   Confirm that all applied migrations match database state and only pending, unapplied migrations are listed.
3. **Execute Deploy from `core-api` Only**:
   ```bash
   npx prisma migrate deploy
   ```
