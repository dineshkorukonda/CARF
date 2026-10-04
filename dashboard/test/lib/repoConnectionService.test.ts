import { describe, it, expect, vi } from "vitest";
import { mapRawRepoConnection } from "../../src/lib/repoConnectionService";

describe("repoConnectionService", () => {
  describe("mapRawRepoConnection", () => {
    it("maps raw row with missing deploymentIntegration, runtimeAdapter, and pm2Process", () => {
      const rawRow = {
        id: "conn-123",
        installationId: "inst-456",
        owner: "dineshkorukonda",
        repo: "my-app",
        mode: "standalone",
        storedConfig: {
          target: "my-app-api",
        },
        monitoringPaused: false,
        verifiedAt: new Date("2026-03-01T00:00:00Z"),
      };

      const mapped = mapRawRepoConnection(rawRow);

      expect(mapped.id).toBe("conn-123");
      expect(mapped.installationId).toBe("inst-456");
      expect(mapped.owner).toBe("dineshkorukonda");
      expect(mapped.repo).toBe("my-app");
      expect(mapped.mode).toBe("standalone");
      expect(mapped.deploymentIntegration).toBe("github_actions");
      expect(mapped.runtimeAdapter).toBe("pm2");
      expect(mapped.pm2Process).toBe("my-app-api");
      expect(mapped.verifiedAt).toEqual(new Date("2026-03-01T00:00:00Z"));
    });

    it("defaults runtimeAdapter to pm2 and pm2Process to sahaay for Sahaay repository", () => {
      const rawRow = {
        id: "conn-sahaay",
        installationId: "163039391",
        owner: "dineshkorukonda",
        repo: "sahaay",
      };

      const mapped = mapRawRepoConnection(rawRow);

      expect(mapped.owner).toBe("dineshkorukonda");
      expect(mapped.repo).toBe("sahaay");
      expect(mapped.runtimeAdapter).toBe("pm2");
      expect(mapped.pm2Process).toBe("sahaay");
      expect(mapped.deploymentIntegration).toBe("github_actions");
    });

    it("preserves explicitly set values if present in the raw row", () => {
      const rawRow = {
        id: "conn-custom",
        installationId: "inst-custom",
        owner: "org",
        repo: "custom-repo",
        mode: "augment",
        deploymentIntegration: "argo_rollouts",
        runtimeAdapter: "none",
        pm2Process: null,
      };

      const mapped = mapRawRepoConnection(rawRow);

      expect(mapped.mode).toBe("augment");
      expect(mapped.deploymentIntegration).toBe("argo_rollouts");
      expect(mapped.runtimeAdapter).toBe("none");
      expect(mapped.pm2Process).toBeNull();
    });
  });
});
