import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton: hot reload re-evaluates this module on every edit,
// which without caching on `globalThis` would open a new Postgres connection pool per
// reload and eventually exhaust the DB's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
