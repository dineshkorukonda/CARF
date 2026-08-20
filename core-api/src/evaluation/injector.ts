import type { CodeFile } from "../classifier/codeComplexityScorer.js";

/**
 * A fabricated commit for the synthetic evaluation harness (#14 — H1 proof), paired with
 * a ground-truth label simulating whether it actually breaks prod. `changedFiles` is fed
 * straight into `classifyCommit()` (src/classifier/vector.ts), the same entry point real
 * commits go through, so the harness exercises the real Tier 1/Tier 2/threshold pipeline
 * rather than a parallel reimplementation of it.
 */
export interface SyntheticDeployment {
  id: string;
  category: "safe" | "risky";
  changedFiles: CodeFile[];
  shouldFail: boolean;
}

/**
 * Safe: a trivial config value tweak. Deliberately not under `k8s/**` (which Tier 1
 * classifies as "infra") so it lands as "config" — see src/classifier/tier1.ts's rule
 * ordering.
 */
function safeConfigTweak(): CodeFile {
  return {
    path: "config/app.yaml",
    before: "logLevel: info\nreplicas: 3\ntimeoutMs: 5000\n",
    after: "logLevel: debug\nreplicas: 3\ntimeoutMs: 5000\n",
  };
}

/** Safe: a one-line log-message wording change — minimal line-delta, classified "code". */
function safeLogTweak(): CodeFile {
  return {
    path: "src/server.ts",
    before: 'export function start() {\n  console.log("server starting");\n  return true;\n}\n',
    after: 'export function start() {\n  console.log("server is starting up");\n  return true;\n}\n',
  };
}

/**
 * Risky: a schema migration. The `migrations/**` file itself classifies as Tier 1 type
 * "data" (see tier1.ts), which counts toward `totalFiles` but contributes to none of
 * `ChangeVector`'s infra/dependency/config/code fields — a migration-only diff would
 * therefore carry zero threshold-engine signal despite being real risk. Realistic
 * migration commits also touch the application code that runs them, so this pairs the
 * migration file with a substantial code-file change to keep the diff signal-bearing.
 */
function riskySchemaMigration(): CodeFile[] {
  return [
    {
      path: "migrations/2026081900_add_orders_table.sql",
      before: "",
      after:
        "CREATE TABLE orders (\n  id SERIAL PRIMARY KEY,\n  customer_id INTEGER NOT NULL,\n  total_cents INTEGER NOT NULL\n);\n",
    },
    {
      path: "src/db/runMigration.ts",
      before: 'export async function runMigrations(client: unknown) {\n  return client;\n}\n',
      after:
        'export async function runMigrations(client: DbClient) {\n' +
        '  await client.query("BEGIN");\n' +
        '  await client.query(readMigrationFile("2026081900_add_orders_table.sql"));\n' +
        '  await client.recordAppliedMigration("2026081900_add_orders_table");\n' +
        '  await client.query("COMMIT");\n' +
        "  return client;\n" +
        "}\n" +
        "\n" +
        "interface DbClient {\n" +
        "  query(sql: string): Promise<unknown>;\n" +
        "  recordAppliedMigration(name: string): Promise<void>;\n" +
        "}\n",
    },
  ];
}

/** Risky: a resource-limit infra change (memory/cpu limits dropped sharply). */
function riskyInfraResourceLimits(): CodeFile {
  return {
    path: "k8s/deployment.yaml",
    before:
      "spec:\n  template:\n    spec:\n      containers:\n        - name: app\n          resources:\n            limits:\n              memory: \"512Mi\"\n              cpu: \"500m\"\n",
    after:
      "spec:\n  template:\n    spec:\n      containers:\n        - name: app\n          resources:\n            limits:\n              memory: \"128Mi\"\n              cpu: \"100m\"\n",
  };
}

/**
 * Generates `n` synthetic deployments, ~50% "safe" (config/log tweaks, should_fail=false)
 * and ~50% "risky" (schema migration or infra resource-limit changes, should_fail=true),
 * alternating by index so an even `n` splits exactly 50/50. Within each half, the two
 * sub-flavors alternate too, so both are represented regardless of `n`.
 */
export function generateSyntheticDeployments(n: number): SyntheticDeployment[] {
  const deployments: SyntheticDeployment[] = [];

  for (let i = 0; i < n; i++) {
    const id = `synthetic-${String(i).padStart(4, "0")}`;
    const isRisky = i % 2 === 1;

    if (isRisky) {
      const flavor = Math.floor(i / 2) % 2 === 0 ? "migration" : "infra";
      deployments.push({
        id,
        category: "risky",
        shouldFail: true,
        changedFiles: flavor === "migration" ? riskySchemaMigration() : [riskyInfraResourceLimits()],
      });
    } else {
      const flavor = Math.floor(i / 2) % 2 === 0 ? "config" : "log";
      deployments.push({
        id,
        category: "safe",
        shouldFail: false,
        changedFiles: [flavor === "config" ? safeConfigTweak() : safeLogTweak()],
      });
    }
  }

  return deployments;
}
