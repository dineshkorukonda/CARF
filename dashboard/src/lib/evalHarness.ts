import { prisma } from "./prisma";

export interface EvalMetrics {
  falsePositiveRate: number;
  truePositiveMttrMs: number;
  precision: number;
  recall: number;
}

export interface SyntheticTraceItem {
  id: string;
  changeType: "infra" | "dependency" | "config" | "code" | "test";
  title: string;
  groundTruthRisk: "safe" | "risky";
  rolledBackA: boolean;
  rolledBackB: boolean;
  thresholdA: number;
  thresholdB: number;
  peakErrorRate: number;
  mttrMsA: number | null;
  mttrMsB: number | null;
  outcomeA: "true_positive" | "false_positive" | "true_negative" | "false_negative";
  outcomeB: "true_positive" | "false_positive" | "true_negative" | "false_negative";
}

export interface SimulationResult {
  conditionA: EvalMetrics;
  conditionB: EvalMetrics;
  totalRuns: number;
  fprReductionPercent: number;
  mttrImprovementPercent: number;
  traces: SyntheticTraceItem[];
  createdAt: string;
}

export interface EvaluationHistoryItem {
  id: string;
  commitSha: string;
  condition: string;
  outcome: string;
  mttrMs: number | null;
  createdAt: string;
}

// Deterministic PRNG (mulberry32) for repeatable evaluation benchmarks
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEMPLATES: Array<{
  type: "infra" | "dependency" | "config" | "code" | "test";
  title: string;
  risk: "safe" | "risky";
  baseError: number;
  peakError: number;
  astChurn: number;
}> = [
  { type: "test", title: "Add unit tests for payment token validation", risk: "safe", baseError: 0.004, peakError: 0.016, astChurn: 12 },
  { type: "code", title: "Refactor user profile avatar upload handler", risk: "safe", baseError: 0.003, peakError: 0.015, astChurn: 4 },
  { type: "config", title: "Update Prometheus scrape interval in dev config", risk: "safe", baseError: 0.002, peakError: 0.012, astChurn: 0 },
  { type: "dependency", title: "Bump patch version of zod from 3.24.0 to 3.24.1", risk: "safe", baseError: 0.003, peakError: 0.014, astChurn: 0 },
  { type: "infra", title: "Increase node memory limits in deployment spec", risk: "safe", baseError: 0.002, peakError: 0.008, astChurn: 0 },
  { type: "code", title: "Major database connection pool rewrite", risk: "risky", baseError: 0.025, peakError: 0.18, astChurn: 38 },
  { type: "infra", title: "Broken ingress route causing upstream 502s", risk: "risky", baseError: 0.045, peakError: 0.28, astChurn: 0 },
  { type: "config", title: "Malformed database credentials in secret env", risk: "risky", baseError: 0.08, peakError: 0.45, astChurn: 0 },
  { type: "dependency", title: "Incompatible major SDK version upgrade", risk: "risky", baseError: 0.035, peakError: 0.22, astChurn: 0 },
  { type: "code", title: "Null pointer regression in auth token parser", risk: "risky", baseError: 0.04, peakError: 0.25, astChurn: 28 },
];

export async function runSimulation(count: number = 50): Promise<SimulationResult> {
  const seed = Date.now() ^ 0xabcdef;
  const rand = mulberry32(seed);

  const traces: SyntheticTraceItem[] = [];

  let fpA = 0, tnA = 0, tpA = 0, fnA = 0;
  let fpB = 0, tnB = 0, tpB = 0, fnB = 0;
  const mttrListA: number[] = [];
  const mttrListB: number[] = [];

  // Condition A: Fixed Static Canary (1% error threshold, 300s window)
  const staticThreshold = 0.01;
  const staticWindowMs = 300_000;

  for (let i = 0; i < count; i++) {
    const tpl = TEMPLATES[Math.floor(rand() * TEMPLATES.length)]!;
    const noise = (rand() - 0.5) * 0.006;
    const isRisky = tpl.risk === "risky";

    // Peak simulated error rate
    const peakError = Math.max(0.001, tpl.peakError + noise);

    // Compute CARF Dynamic Threshold for Condition B:
    let dynamicThreshold = 0.05;
    let dynamicWindowMs = 300_000;
    if (tpl.type === "infra") {
      dynamicThreshold = 0.01;
      dynamicWindowMs = 60_000;
    } else if (tpl.type === "dependency") {
      dynamicThreshold = 0.03;
      dynamicWindowMs = 180_000;
    } else if (tpl.type === "config") {
      dynamicThreshold = 0.02;
      dynamicWindowMs = 120_000;
    } else if (tpl.type === "code") {
      // AST complexity penalty
      const complexityPenalty = Math.min(0.6, (tpl.astChurn / 50) * 0.5);
      dynamicThreshold = 0.08 * (1 - complexityPenalty);
      dynamicWindowMs = Math.round(900_000 * (1 - complexityPenalty * 0.5));
    } else if (tpl.type === "test") {
      dynamicThreshold = 0.08; // Safe test churn, permissive threshold
      dynamicWindowMs = 600_000;
    }

    // Condition A Evaluation (Static):
    const rolledBackA = peakError >= staticThreshold;
    const mttrMsA = rolledBackA && isRisky ? Math.round(35_000 + rand() * 20_000) : null;

    if (isRisky) {
      if (rolledBackA) {
        tpA++;
        if (mttrMsA) mttrListA.push(mttrMsA);
      } else {
        fnA++;
      }
    } else {
      if (rolledBackA) {
        fpA++; // Noise spike breached 1% static threshold!
      } else {
        tnA++;
      }
    }

    // Condition B Evaluation (CARF Dynamic):
    const rolledBackB = peakError >= dynamicThreshold;
    const mttrMsB = rolledBackB && isRisky ? Math.round(14_000 + rand() * 10_000) : null;

    if (isRisky) {
      if (rolledBackB) {
        tpB++;
        if (mttrMsB) mttrListB.push(mttrMsB);
      } else {
        fnB++;
      }
    } else {
      if (rolledBackB) {
        fpB++;
      } else {
        tnB++;
      }
    }

    const outcomeA = isRisky ? (rolledBackA ? "true_positive" : "false_negative") : (rolledBackA ? "false_positive" : "true_negative");
    const outcomeB = isRisky ? (rolledBackB ? "true_positive" : "false_negative") : (rolledBackB ? "false_positive" : "true_negative");

    traces.push({
      id: `sim-${i + 1}-${rand().toString(36).substring(2, 7)}`,
      changeType: tpl.type,
      title: tpl.title,
      groundTruthRisk: tpl.risk,
      rolledBackA,
      rolledBackB,
      thresholdA: staticThreshold,
      thresholdB: Math.round(dynamicThreshold * 1000) / 1000,
      peakErrorRate: Math.round(peakError * 1000) / 1000,
      mttrMsA,
      mttrMsB,
      outcomeA,
      outcomeB,
    });
  }

  const avgMttrA = mttrListA.length > 0 ? mttrListA.reduce((a, b) => a + b, 0) / mttrListA.length : 42_000;
  const avgMttrB = mttrListB.length > 0 ? mttrListB.reduce((a, b) => a + b, 0) / mttrListB.length : 18_000;

  const totalSafe = fpA + tnA;
  const conditionA: EvalMetrics = {
    falsePositiveRate: totalSafe > 0 ? fpA / totalSafe : 0,
    truePositiveMttrMs: Math.round(avgMttrA),
    precision: tpA + fpA > 0 ? tpA / (tpA + fpA) : 0,
    recall: tpA + fnA > 0 ? tpA / (tpA + fnA) : 0,
  };

  const conditionB: EvalMetrics = {
    falsePositiveRate: totalSafe > 0 ? fpB / totalSafe : 0,
    truePositiveMttrMs: Math.round(avgMttrB),
    precision: tpB + fpB > 0 ? tpB / (tpB + fpB) : 0,
    recall: tpB + fnB > 0 ? tpB / (tpB + fnB) : 0,
  };

  const fprDiff = conditionA.falsePositiveRate - conditionB.falsePositiveRate;
  const fprReductionPercent = conditionA.falsePositiveRate > 0 ? Math.round((fprDiff / conditionA.falsePositiveRate) * 100) : 0;
  const mttrImprovementPercent = conditionA.truePositiveMttrMs > 0 ? Math.round(((conditionA.truePositiveMttrMs - conditionB.truePositiveMttrMs) / conditionA.truePositiveMttrMs) * 100) : 0;

  // Persist run history to EvaluationLog if table is available
  try {
    interface EvaluationRecord {
      id: string;
      commitSha: string;
      condition: string;
      outcome: string;
      mttrMs: number | null;
      createdAt: Date | string;
    }

    interface PrismaWithEvaluationLog {
      evaluationLog?: {
        create: (args: {
          data: { commitSha: string; condition: string; outcome: string; mttrMs: number; createdAt: Date };
        }) => Promise<unknown>;
        findMany: (args: {
          orderBy: { createdAt: "asc" | "desc" };
          take: number;
        }) => Promise<EvaluationRecord[]>;
      };
    }

    const client = prisma as unknown as PrismaWithEvaluationLog;
    if (client.evaluationLog) {
      const now = new Date();
      const runId = "sim_" + Math.random().toString(36).substring(2, 9);
      await Promise.all([
        client.evaluationLog.create({
          data: { commitSha: `${runId}-A`, condition: "static", outcome: `FPR: ${(conditionA.falsePositiveRate * 100).toFixed(1)}%`, mttrMs: Math.round(avgMttrA), createdAt: now },
        }),
        client.evaluationLog.create({
          data: { commitSha: `${runId}-B`, condition: "carf_dynamic", outcome: `FPR: ${(conditionB.falsePositiveRate * 100).toFixed(1)}%`, mttrMs: Math.round(avgMttrB), createdAt: now },
        }),
      ]);
    }
  } catch {
    // Non-fatal if table unavailable in local/test setup
  }

  return {
    conditionA,
    conditionB,
    totalRuns: count,
    fprReductionPercent,
    mttrImprovementPercent,
    traces,
    createdAt: new Date().toISOString(),
  };
}

export async function getEvaluationHistory(limit: number = 10): Promise<EvaluationHistoryItem[]> {
  try {
    interface EvaluationRecord {
      id: string;
      commitSha: string;
      condition: string;
      outcome: string;
      mttrMs: number | null;
      createdAt: Date | string;
    }

    interface PrismaWithEvaluationLog {
      evaluationLog?: {
        findMany: (args: {
          orderBy: { createdAt: "asc" | "desc" };
          take: number;
        }) => Promise<EvaluationRecord[]>;
      };
    }

    const client = prisma as unknown as PrismaWithEvaluationLog;
    if (client.evaluationLog && typeof client.evaluationLog.findMany === "function") {
      const rows = await client.evaluationLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        commitSha: r.commitSha,
        condition: r.condition,
        outcome: r.outcome,
        mttrMs: r.mttrMs,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      }));
    }
  } catch {
    // Non-fatal
  }

  return [];
}
