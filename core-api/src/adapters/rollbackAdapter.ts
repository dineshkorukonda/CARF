/**
 * Common contract for standalone-mode rollback execution adapters. Each concrete
 * adapter (docker compose, kubectl, ...) knows how to poll target health and how to
 * execute a rollback for its own runtime, but exposes the same shape so `loop.ts` can
 * drive any of them without knowing which one it has.
 */
export interface RollbackAdapter {
  checkHealth(target?: string): Promise<{
    errorRate: number;
    healthy: boolean;
    processErrorRate?: number;
    httpErrorRate?: number;
  }>;
  rollback(target?: string): Promise<void>;
  /** Put `sha` live on the host so soak/health see that commit, not whatever was already running. */
  applyRelease?(sha: string, target?: string): Promise<void>;
  /** Capture the actual deployed revision before changing files, for durable rollback. */
  getCurrentRevision?(): Promise<string>;
  rollbackWithVerification?(
    target?: string,
    graceSeconds?: number
  ): Promise<{ rollbackVerified: boolean; verified?: boolean; errorRate?: number }>;
}
