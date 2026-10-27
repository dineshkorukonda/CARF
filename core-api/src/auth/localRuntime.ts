/** Host command execution is opt-in for a single operator-bound installation.
 * An agent heartbeat does not provide a remote execution transport. */
export function localRuntimeAllowed(installationId: string | null | undefined, binding = process.env.CARF_LOCAL_INSTALLATION_ID): boolean {
  return Boolean(binding && installationId && binding === installationId);
}

export const LOCAL_RUNTIME_ERROR = "Local runtime execution is not enabled for this installation. Run core-api on the application host and configure CARF_LOCAL_INSTALLATION_ID; the verification agent does not execute remote commands.";
