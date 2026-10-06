import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";

/**
 * Shared shell-exec seam for the Standalone rollback adapters (kubectl, docker compose,
 * pm2) that shell out. Injectable so unit tests never actually spawn a process — tests
 * inject a fake, production code gets `defaultExec`.
 */
export type ExecFn = (command: string, options?: { cwd?: string }) => Promise<{ stdout: string; stderr: string }>;

export const defaultExec: ExecFn = promisify(execCallback);

export interface CommandExecutor {
  exec(command: string, options?: { cwd?: string }): Promise<{ stdout: string; stderr: string }>;
}

export class LocalCommandExecutor implements CommandExecutor {
  constructor(private readonly execFn: ExecFn = defaultExec) {}

  async exec(command: string, options?: { cwd?: string }): Promise<{ stdout: string; stderr: string }> {
    if (options !== undefined) {
      return this.execFn(command, options);
    }
    return this.execFn(command);
  }
}

const TARGET_REGEX = /^[a-zA-Z0-9_./:\\ -]+$/;
const DANGEROUS_SHELL_CHARS = /[;&|`$()<>"'\n\r]/;

/**
 * Validates that an adapter target (or namespace/path argument) contains only safe
 * alphanumeric and path characters to protect against shell injection attacks.
 * Accepts standard POSIX and Windows file path characters and spaces while strictly
 * rejecting shell injection metacharacters.
 */
export function assertSafeTarget(target: string, paramName: string = "target"): void {
  if (!target || !TARGET_REGEX.test(target) || DANGEROUS_SHELL_CHARS.test(target)) {
    throw new Error(`Invalid ${paramName} "${target}": contains illegal shell characters`);
  }
}
