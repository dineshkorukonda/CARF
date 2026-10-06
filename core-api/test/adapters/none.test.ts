import { describe, expect, it } from "vitest";
import { NoneRuntimeAdapter } from "../../src/adapters/none.js";

describe("NoneRuntimeAdapter (Policy-Only Runtime)", () => {
  it("reports available and discovers empty process list", async () => {
    const adapter = new NoneRuntimeAdapter();
    expect(await adapter.isAvailable()).toBe(true);
    expect(await adapter.discover()).toEqual([]);
  });

  it("returns online status indicating policy-only gating", async () => {
    const adapter = new NoneRuntimeAdapter();
    const status = await adapter.getStatus("test-service");
    expect(status.target).toBe("test-service");
    expect(status.status).toBe("online");
    expect(status.version).toBeNull();
  });

  it("reports healthy with errorRate 0 for health checks", async () => {
    const adapter = new NoneRuntimeAdapter();
    const health = await adapter.checkHealth();
    expect(health.healthy).toBe(true);
    expect(health.errorRate).toBe(0);
  });

  it("handles rollback as a safe no-op", async () => {
    const adapter = new NoneRuntimeAdapter();
    await expect(adapter.rollback()).resolves.toBeUndefined();
    const verification = await adapter.rollbackWithVerification();
    expect(verification.rollbackVerified).toBe(true);
  });
});
