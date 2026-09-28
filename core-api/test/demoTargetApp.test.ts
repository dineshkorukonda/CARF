import { describe, expect, it, vi } from "vitest";
import { PM2Adapter } from "../src/adapters/pm2.js";
import { runStandaloneLoop } from "../src/adapters/loop.js";

import type { PipelineResult } from "../src/pipeline/processCommit.js";

describe("Demo Target App & PM2 Adapter E2E Simulation", () => {
  it("simulates full standalone monitoring, detects breach, and triggers verified rollback", async () => {
    const executedCommands: string[] = [];
    const execMock = vi.fn(async (cmd: string) => {
      executedCommands.push(cmd);
      if (cmd === "pm2 jlist") {
        return {
          stdout: JSON.stringify([
            { pm_id: 0, name: "demo-target-app", pm2_env: { status: "online", restart_time: 0 } },
            { pm_id: 1, name: "demo-target-app", pm2_env: { status: "online", restart_time: 0 } },
          ]),
          stderr: "",
        };
      }
      return { stdout: "", stderr: "" };
    });

    let probeCount = 0;
    const fetchMock = vi.fn(async (_url: string) => {
      probeCount++;
      // First 2 polls (4 probes) are unhealthy 500s, breaching the threshold
      if (probeCount <= 4) {
        return { ok: false, status: 500 };
      }
      // Post-rollback probes return 200 OK
      return { ok: true, status: 200 };
    });

    const adapter = new PM2Adapter("sha-v1", {
      exec: execMock,
      target: "demo-target-app",
      layout: "releases",
      releasesRoot: "/tmp/carf-demo/releases",
      currentSymlink: "/tmp/carf-demo/current",
      healthUrl: "http://localhost:3000/health",
      probeCount: 2,
      fetchFn: fetchMock,
    });

    const pipelineResult: PipelineResult = {
      changeTypes: ["code"],
      typeWeights: { code: 1 },
      totalWeight: 1,
      classificationBreakdown: { infra: 0, dependency: 0, config: 0, code: 1, data: 0 },
      windowModifiers: { code: 1 },
      baseThreshold: 0.05,
      finalThreshold: 0.05,
      baseWindow: 10,
      finalWindow: 10,
      durationMinutes: 1,
    };

    // Run standalone loop with fast polling interval for test
    const loopResult = await runStandaloneLoop(
      "sha-v2",
      adapter,
      pipelineResult,
      "demo-target-app",
      { pollIntervalSeconds: 0.01 }
    );

    expect(loopResult.rolledBack).toBe(true);
    expect(loopResult.finalErrorRate).toBeGreaterThan(0.05);

    // Verify rollback commands were executed in order
    expect(executedCommands).toContain(
      "test -d /tmp/carf-demo/releases/sha-v1 && ln -sfn /tmp/carf-demo/releases/sha-v1 /tmp/carf-demo/current"
    );
    expect(executedCommands).toContain("pm2 reload demo-target-app");
  });
});
