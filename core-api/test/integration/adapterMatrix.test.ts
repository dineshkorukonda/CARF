import { describe, expect, it, vi } from "vitest";
import { PM2Adapter } from "../../src/adapters/pm2.js";
import { DockerAdapter } from "../../src/adapters/docker.js";
import { KubernetesAdapter } from "../../src/adapters/kubernetes.js";
import { ArgoRolloutsIntegration } from "../../src/adapters/argoRollouts.js";
import { FlaggerIntegration } from "../../src/adapters/flagger.js";

interface MatrixRunRecord {
  platform: string;
  automatedTestPassed: boolean;
  failureTestPassed: boolean;
  rollbackTestPassed: boolean;
  recoveryVerified: boolean;
  status: "CONTRACT-TESTED";
  logs: string[];
}

const matrixResults: Record<string, MatrixRunRecord> = {};

describe("Phase 8 — Full Target Environments & Adapters Integration Matrix", () => {
  describe("Environment A: PM2 (Reference Environment)", () => {
    it("executes automated test, failure test, rollback, and verified recovery", async () => {
      const logs: string[] = [];
      const previousSha = "sha-v1-stable";
      const currentSha = "sha-v2-broken";

      let currentRelease = currentSha;
      const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
        logs.push(`[pm2:cmd] ${cmd}`);
        if (cmd.startsWith("pm2 jlist")) {
          const isHealthy = currentRelease === previousSha;
          return {
            stdout: JSON.stringify([
              {
                name: "sample-pm2-app",
                pm_id: 1,
                pm2_env: {
                  status: isHealthy ? "online" : "errored",
                  restart_time: isHealthy ? 0 : 4,
                  pm_uptime: Date.now() - 5000,
                },
              },
            ]),
            stderr: "",
          };
        }
        if (cmd.includes("ln -sfn") || cmd.includes("git checkout")) {
          currentRelease = previousSha;
        }
        return { stdout: "", stderr: "" };
      });

      const adapter = new PM2Adapter(previousSha, {
        exec: mockExec,
        target: "sample-pm2-app",
        startupGraceSeconds: 5,
      });

      // 1. Failure test: detects broken release
      const preRollbackHealth = await adapter.checkHealth();
      expect(preRollbackHealth.healthy).toBe(false);
      expect(preRollbackHealth.errorRate).toBeGreaterThan(0);
      logs.push(`[pm2:health] Broken release detected with errorRate=${preRollbackHealth.errorRate}`);

      // 2. Rollback test: triggers rollback to previous stable SHA
      const recovery = await adapter.rollbackWithVerification("sample-pm2-app");
      expect(recovery.rollbackVerified).toBe(true);
      expect(recovery.errorRate).toBe(0);
      logs.push("[pm2:recovery] Rollback successfully restored previous release");

      matrixResults["PM2"] = {
        platform: "PM2",
        automatedTestPassed: true,
        failureTestPassed: !preRollbackHealth.healthy,
        rollbackTestPassed: true,
        recoveryVerified: recovery.rollbackVerified,
        status: "CONTRACT-TESTED",
        logs,
      };
    });
  });

  describe("Environment B: Docker Compose", () => {
    it("executes automated test, failure test, rollback, and verified recovery", async () => {
      const logs: string[] = [];
      const previousImage = "carf-sample-app:v1";

      let containerRunning = false;
      const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
        logs.push(`[docker:cmd] ${cmd}`);
        if (cmd.includes("docker inspect")) {
          return {
            stdout: JSON.stringify([
              {
                State: {
                  Status: containerRunning ? "running" : "exited",
                  Running: containerRunning,
                  Dead: !containerRunning,
                  ExitCode: containerRunning ? 0 : 1,
                  StartedAt: new Date().toISOString(),
                },
                RestartCount: containerRunning ? 0 : 5,
                Config: { Image: containerRunning ? previousImage : "carf-sample-app:broken", Labels: { "com.docker.compose.service": "sample-app" } },
              },
            ]),
            stderr: "",
          };
        }
        if (cmd.includes("docker compose") || cmd.includes("docker run")) {
          containerRunning = true;
        }
        return { stdout: "", stderr: "" };
      });

      const adapter = new DockerAdapter(previousImage, {
        containerName: "carf-sample-docker-app",
        composeFile: "environments/docker/compose.yml",
        exec: mockExec,
        startupGraceSeconds: 5,
      });

      // 1. Failure test: detects exited / restarting container
      const failedHealth = await adapter.checkHealth();
      expect(failedHealth.healthy).toBe(false);
      expect(failedHealth.errorRate).toBe(1.0);
      logs.push("[docker:health] Detected broken container with errorRate=1.0");

      // 2. Rollback & recovery: recreates container from previous image
      const recovery = await adapter.rollbackWithVerification();
      expect(recovery.rollbackVerified).toBe(true);
      expect(recovery.errorRate).toBe(0);
      logs.push("[docker:recovery] Container rollback restored stable state");

      matrixResults["Docker"] = {
        platform: "Docker",
        automatedTestPassed: true,
        failureTestPassed: !failedHealth.healthy,
        rollbackTestPassed: true,
        recoveryVerified: recovery.rollbackVerified,
        status: "CONTRACT-TESTED",
        logs,
      };
    });
  });

  describe("Environment C: Kubernetes", () => {
    it("executes automated test, failure test, rollback, and verified recovery", async () => {
      const logs: string[] = [];
      let rolloutHealthy = false;

      const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
        logs.push(`[k8s:cmd] ${cmd}`);
        if (cmd.includes("kubectl get deployment")) {
          return {
            stdout: JSON.stringify({
              spec: { replicas: 2 },
              status: {
                replicas: 2,
                availableReplicas: rolloutHealthy ? 2 : 0,
                unavailableReplicas: rolloutHealthy ? 0 : 2,
              },
            }),
            stderr: "",
          };
        }
        if (cmd.includes("kubectl rollout undo")) {
          rolloutHealthy = true;
          return { stdout: "deployment.apps/sample-k8s-app rolled back\n", stderr: "" };
        }
        if (cmd.includes("kubectl rollout status")) {
          return { stdout: "deployment \"sample-k8s-app\" successfully rolled out\n", stderr: "" };
        }
        return { stdout: "", stderr: "" };
      });

      const adapter = new KubernetesAdapter("1", {
        namespace: "carf-test",
        deploymentName: "sample-k8s-app",
        exec: mockExec,
      });

      // 1. Failure test: detects 0 available replicas
      const failedHealth = await adapter.checkHealth();
      expect(failedHealth.healthy).toBe(false);
      expect(failedHealth.errorRate).toBe(1.0);
      logs.push("[k8s:health] Deficit in available pods detected");

      // 2. Rollback & recovery test: native rollout undo
      const recovery = await adapter.rollbackWithVerification();
      expect(recovery.rollbackVerified).toBe(true);
      expect(recovery.errorRate).toBe(0);
      logs.push("[k8s:recovery] kubectl rollout undo verified successful");

      matrixResults["Kubernetes"] = {
        platform: "Kubernetes",
        automatedTestPassed: true,
        failureTestPassed: !failedHealth.healthy,
        rollbackTestPassed: true,
        recoveryVerified: recovery.rollbackVerified,
        status: "CONTRACT-TESTED",
        logs,
      };
    });
  });

  describe("Environment D: Argo Rollouts", () => {
    it("executes automated test, failure test, abort, and rollback", async () => {
      const logs: string[] = [];
      let aborted = false;

      const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
        logs.push(`[argo:cmd] ${cmd}`);
        if (cmd.includes("kubectl get rollout")) {
          return {
            stdout: JSON.stringify({
              metadata: { name: "sample-argo-rollout", namespace: "carf-test" },
              status: {
                phase: aborted ? "Aborted" : "Degraded",
                message: aborted ? "Rollout aborted" : "Analysis run failed on error rate breach",
                canary: { weights: { canary: { weight: 20 } } },
              },
            }),
            stderr: "",
          };
        }
        if (cmd.includes("kubectl argo rollouts abort")) {
          aborted = true;
          return { stdout: "rollout 'sample-argo-rollout' aborted\n", stderr: "" };
        }
        if (cmd.includes("kubectl argo rollouts undo")) {
          return { stdout: "rollout 'sample-argo-rollout' reverted\n", stderr: "" };
        }
        return { stdout: "", stderr: "" };
      });

      const integration = new ArgoRolloutsIntegration({
        namespace: "carf-test",
        defaultRollout: "sample-argo-rollout",
        exec: mockExec,
      });

      // 1. Failure state observation
      const initialStatus = await integration.getDeploymentStatus("sample-argo-rollout");
      expect(initialStatus.phase).toBe("failed");
      logs.push("[argo:status] Rollout degraded detected");

      // 2. Abort & rollback execution
      await integration.rollback("sample-argo-rollout");
      const postRollbackStatus = await integration.getDeploymentStatus("sample-argo-rollout");
      expect(postRollbackStatus.phase).toBe("aborted");
      logs.push("[argo:recovery] Rollout abort & undo executed successfully");

      matrixResults["Argo Rollouts"] = {
        platform: "Argo Rollouts",
        automatedTestPassed: true,
        failureTestPassed: initialStatus.phase === "failed",
        rollbackTestPassed: true,
        recoveryVerified: true,
        status: "CONTRACT-TESTED",
        logs,
      };
    });
  });

  describe("Environment E: Flagger", () => {
    it("executes automated test, failure test, and canary rollback", async () => {
      const logs: string[] = [];
      let canaryHalted = false;

      const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
        logs.push(`[flagger:cmd] ${cmd}`);
        if (cmd.includes("kubectl get canary")) {
          return {
            stdout: JSON.stringify({
              metadata: { name: "sample-app-canary", namespace: "carf-test" },
              status: {
                phase: canaryHalted ? "Initialized" : "Failed",
                canaryWeight: canaryHalted ? 0 : 30,
                failedChecks: canaryHalted ? 0 : 5,
                conditions: [
                  {
                    type: "Promoted",
                    status: "False",
                    message: canaryHalted ? "Canary reverted to primary" : "Halt canary: 5 threshold breaches",
                  },
                ],
              },
            }),
            stderr: "",
          };
        }
        if (cmd.includes("annotate canary") || cmd.includes("set image")) {
          canaryHalted = true;
          return { stdout: "annotated\n", stderr: "" };
        }
        return { stdout: "", stderr: "" };
      });

      const integration = new FlaggerIntegration({
        namespace: "carf-test",
        defaultCanary: "sample-app-canary",
        exec: mockExec,
      });

      // 1. Failure state observation
      const failedStatus = await integration.getDeploymentStatus("sample-app-canary");
      expect(failedStatus.phase).toBe("failed");
      logs.push("[flagger:status] Canary failure detected with 5 breached checks");

      // 2. Canary rollback to primary
      await integration.rollback("sample-app-canary", {
        sha: "broken-sha",
        baseSha: "stable-sha",
      });
      const recoveredStatus = await integration.getDeploymentStatus("sample-app-canary");
      expect(recoveredStatus.phase).toBe("healthy");
      logs.push("[flagger:recovery] Canary halted and traffic reset 100% to primary");

      matrixResults["Flagger"] = {
        platform: "Flagger",
        automatedTestPassed: true,
        failureTestPassed: failedStatus.phase === "failed",
        rollbackTestPassed: true,
        recoveryVerified: recoveredStatus.phase === "healthy",
        status: "CONTRACT-TESTED",
        logs,
      };
    });
  });

  it("verifies all 5 platforms pass the full integration test matrix", () => {
    const platforms = ["PM2", "Docker", "Kubernetes", "Argo Rollouts", "Flagger"];
    for (const p of platforms) {
      const record = matrixResults[p];
      expect(record, `Expected results for ${p}`).toBeDefined();
      if (!record) continue;
      expect(record.automatedTestPassed, `${p} automated test`).toBe(true);
      expect(record.failureTestPassed, `${p} failure test`).toBe(true);
      expect(record.rollbackTestPassed, `${p} rollback test`).toBe(true);
      expect(record.recoveryVerified, `${p} recovery verified`).toBe(true);
      expect(record.logs.length, `${p} logs recorded`).toBeGreaterThan(0);
    }
  });
});
