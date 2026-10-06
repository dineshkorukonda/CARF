import type { RuntimeAdapter, RuntimeHealthResult, RuntimeStatus } from "./contracts.js";

/**
 * Null runtime adapter representing Policy-Only deployment mode.
 * Operates without host agents or runtime hooks.
 * Health checks always report healthy, and rollbacks are delegated to external CI/CD pipelines.
 */
export class NoneRuntimeAdapter implements RuntimeAdapter {
  readonly kind = "none";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async discover(): Promise<string[]> {
    return [];
  }

  async getStatus(target: string = "none"): Promise<RuntimeStatus> {
    return {
      target,
      status: "online",
      version: null,
      metadata: { description: "Policy-only gating; no direct runtime execution" },
    };
  }

  async checkHealth(_target?: string): Promise<RuntimeHealthResult> {
    return {
      errorRate: 0,
      healthy: true,
      processErrorRate: 0,
      httpErrorRate: 0,
    };
  }

  async rollback(_target?: string): Promise<void> {
    // No-op for runtime none; CI/CD pipeline handles policy rejection
  }

  async rollbackWithVerification(
    _target?: string,
    _graceSeconds?: number
  ): Promise<{ rollbackVerified: boolean; verified?: boolean; errorRate?: number }> {
    return {
      rollbackVerified: true,
      verified: true,
      errorRate: 0,
    };
  }
}
