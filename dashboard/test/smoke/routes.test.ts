// Smoke test: import every route handler, page and layout in the app and check it exposes
// what Next.js will look for. It asserts almost nothing about behaviour -- that is the job
// of test/routes/ and test/lib/. What it catches is the class of failure those suites
// cannot: a module that throws while it is being loaded.
//
// That happens for real. A top-level `env.baseUrl()` instead of a call inside the handler,
// a circular import, or a bad barrel export all produce a module that type-checks, lints
// and passes every unit test, then fails at runtime the first time a request touches it.
//
// Same intent as core-api/test/smoke/server.test.ts, which boots the Fastify app and asks
// whether the routes are actually registered. Next.js has no equivalent buildApp() to call,
// so the import itself is the boot.

import { describe, expect, it, vi } from "vitest";

// PrismaClient is constructed at import time by src/lib/prisma.ts. It does not connect
// eagerly, so no database is needed here -- but keep it stubbed so a missing generated
// client can never be mistaken for a broken route module.
vi.mock("@prisma/client", () => ({ PrismaClient: class {} }));

const ROUTE_MODULES: Array<[path: string, verbs: string[], loader: () => Promise<unknown>]> = [
  ["api/auth/[...nextauth]", ["GET", "POST"], () => import("../../src/app/api/auth/[...nextauth]/route")],
  ["api/compat-check", ["POST"], () => import("../../src/app/api/compat-check/route")],
  ["api/config/save", ["POST"], () => import("../../src/app/api/config/save/route")],
  ["api/config/save-rules", ["POST"], () => import("../../src/app/api/config/save-rules/route")],
  ["api/github-app/install/callback", ["GET"], () => import("../../src/app/api/github-app/install/callback/route")],
  ["api/eval/run", ["POST"], () => import("../../src/app/api/eval/run/route")],
  ["api/eval/history", ["GET"], () => import("../../src/app/api/eval/history/route")],
  ["api/github-app/install/manual", ["POST"], () => import("../../src/app/api/github-app/install/manual/route")],
  ["api/github-app/install/start", ["GET"], () => import("../../src/app/api/github-app/install/start/route")],
  ["api/pm2/apps", ["GET"], () => import("../../src/app/api/pm2/apps/route")],
  ["api/repo/connection-check", ["POST"], () => import("../../src/app/api/repo/connection-check/route")],
  ["api/repo/pause", ["POST"], () => import("../../src/app/api/repo/pause/route")],
  ["api/rollouts/[id]/rollback", ["POST"], () => import("../../src/app/api/rollouts/[id]/rollback/route")],
  ["api/rollouts/[id]/samples", ["GET"], () => import("../../src/app/api/rollouts/[id]/samples/route")],
];

const PAGE_MODULES: Array<[path: string, loader: () => Promise<unknown>]> = [
  ["/", () => import("../../src/app/page")],
  ["(auth)/login", () => import("../../src/app/(auth)/login/page")],
  ["dashboard", () => import("../../src/app/dashboard/page")],
  ["dashboard/repos", () => import("../../src/app/dashboard/repos/page")],
  ["dashboard/repos/[...repo]", () => import("../../src/app/dashboard/repos/[...repo]/page")],
  ["dashboard/setup", () => import("../../src/app/dashboard/setup/page")],
  ["dashboard/verify", () => import("../../src/app/dashboard/verify/page")],
  ["dashboard/settings", () => import("../../src/app/dashboard/settings/page")],
];

const LAYOUT_MODULES: Array<[path: string, loader: () => Promise<unknown>]> = [
  ["root", () => import("../../src/app/layout")],
  ["dashboard", () => import("../../src/app/dashboard/layout")],
];

describe("every API route module loads and exports its handler", () => {
  it.each(ROUTE_MODULES)("%s exports %s", async (_path, verbs, load) => {
    const loaded = (await load()) as Record<string, unknown>;

    for (const verb of verbs) {
      expect(typeof loaded[verb]).toBe("function");
    }
  });

  // Next.js infers the allowed methods from the exports. An accidental extra export would
  // quietly open a method nobody meant to serve.
  it.each(ROUTE_MODULES)("%s exports no HTTP verb beyond %s", async (_path, verbs, load) => {
    const loaded = (await load()) as Record<string, unknown>;
    const allVerbs = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

    expect(allVerbs.filter((v) => typeof loaded[v] === "function").sort()).toEqual([...verbs].sort());
  });
});

// A page pulls in its whole component tree, and Vite transforms every file the first time
// it is imported. The larger config pages exceed the 5s default on a cold run, so these
// three suites get a timeout sized for transform cost rather than for the assertion.
const IMPORT_TIMEOUT_MS = 30_000;

describe("every page module loads and exports a component", () => {
  it.each(PAGE_MODULES)(
    "%s exports a default component",
    async (_path, load) => {
      const loaded = (await load()) as { default?: unknown };

      expect(typeof loaded.default).toBe("function");
    },
    IMPORT_TIMEOUT_MS
  );
});

describe("every layout module loads and exports a component", () => {
  it.each(LAYOUT_MODULES)(
    "%s layout exports a default component",
    async (_path, load) => {
      const loaded = (await load()) as { default?: unknown };

      expect(typeof loaded.default).toBe("function");
    },
    IMPORT_TIMEOUT_MS
  );
});
