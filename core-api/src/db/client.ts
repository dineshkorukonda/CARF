import { PrismaClient } from "@prisma/client";

// Singleton PrismaClient. Follows the same lazy-validation convention as
// core-api/src/config/env.ts (see requireEnv): we don't eagerly read/validate
// DATABASE_URL here — Prisma's own `env("DATABASE_URL")` datasource binding
// (see prisma/schema.prisma) resolves and validates it lazily, on first query. This
// keeps importing this module safe in test/CI environments that never touch the DB
// (classifier tests, etc. stay DB-free per core-api/CLAUDE.md) without needing a
// DATABASE_URL to be set just to load the module graph.
export const prisma = new PrismaClient();
