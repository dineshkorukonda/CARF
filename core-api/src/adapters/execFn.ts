import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

/**
 * Shared shell-exec seam for the Standalone rollback adapters (kubectl, docker compose,
 * pm2) that shell out. Injectable so unit tests never actually spawn a process — tests
 * inject a fake, production code gets `defaultExec`.
 */
export type ExecFn = (command: string) => Promise<{ stdout: string; stderr: string }>;

export const defaultExec: ExecFn = promisify(execCallback);
