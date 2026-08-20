/**
 * Common contract for standalone-mode rollback execution adapters. Each concrete
 * adapter (docker compose, kubectl, ...) knows how to poll target health and how to
 * execute a rollback for its own runtime, but exposes the same shape so `loop.ts` can
 * drive any of them without knowing which one it has.
 */
export interface RollbackAdapter {
  checkHealth(target: string): Promise<{ errorRate: number; healthy: boolean }>;
  rollback(target: string): Promise<void>;
}
