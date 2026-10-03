export type DerivedRepoStatus =
  | "Not connected"
  | "Not verified"
  | "Connected, no rollouts yet"
  | "Observing (PENDING)"
  | "Last rollout succeeded"
  | "Last rollout succeeded, connection unverified"
  | "Last rollout rolled back"
  | "Adapter error"
  | "Policy Ready"
  | "Augment Active";

export interface RepoStatusInput {
  /** Whether .carf.yml exists or a DB storedConfig is present */
  isConfigured: boolean;
  /** Whether the connection check has passed (verifiedAt is not null) */
  isVerified: boolean;
  /** Whether an active rollout is currently in PENDING state */
  hasPendingRollout?: boolean;
  /** The terminal or active status of the most recent rollout */
  latestOutcomeStatus?: "PENDING" | "SUCCESS" | "ROLLED_BACK" | "FAILED" | null;
  /** Total count of recorded RolloutOutcome rows for this repository */
  totalRollouts: number;
  /** Deployment mode: "standalone" | "augment" */
  mode?: "standalone" | "augment";
}

/**
 * Derives repository operational status strictly from recorded data.
 *
 * For Augment mode:
 * - Shows "Not connected" if not configured.
 * - Shows "Policy Ready" when configured. Augment mode does not require PM2 verification.
 *
 * For Standalone mode:
 * - Shows "Not connected" if no config exists.
 * - Shows "Not verified" until connection check has passed, UNLESS the last rollout succeeded
 *   ("Last rollout succeeded, connection unverified").
 * - Never shows a healthy state without at least one terminal outcome.
 */
export function deriveRepoStatus(input: RepoStatusInput): DerivedRepoStatus {
  if (!input.isConfigured) {
    return "Not connected";
  }

  // Augment mode is strictly policy-based (external CD owns deployment/monitoring/rollback)
  if (input.mode === "augment") {
    return "Policy Ready";
  }

  if (input.hasPendingRollout || input.latestOutcomeStatus === "PENDING") {
    return "Observing (PENDING)";
  }
  if (!input.isVerified) {
    if (input.latestOutcomeStatus === "SUCCESS") {
      return "Last rollout succeeded, connection unverified";
    }
    if (input.latestOutcomeStatus === "ROLLED_BACK") {
      return "Last rollout rolled back";
    }
    if (input.latestOutcomeStatus === "FAILED") {
      return "Adapter error";
    }
    return "Not verified";
  }
  if (input.totalRollouts === 0 || !input.latestOutcomeStatus) {
    return "Connected, no rollouts yet";
  }
  if (input.latestOutcomeStatus === "SUCCESS") {
    return "Last rollout succeeded";
  }
  if (input.latestOutcomeStatus === "ROLLED_BACK") {
    return "Last rollout rolled back";
  }
  if (input.latestOutcomeStatus === "FAILED") {
    return "Adapter error";
  }
  return "Connected, no rollouts yet";
}

export function getStatusBadgeVariant(status: DerivedRepoStatus): {
  colorClass: string;
  dotClass: string;
} {
  switch (status) {
    case "Policy Ready":
    case "Augment Active":
      return {
        colorClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        dotClass: "bg-emerald-500",
      };
    case "Observing (PENDING)":
      return {
        colorClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
        dotClass: "bg-amber-500 animate-pulse",
      };
    case "Last rollout succeeded":
      return {
        colorClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        dotClass: "bg-emerald-500",
      };
    case "Last rollout succeeded, connection unverified":
      return {
        colorClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
        dotClass: "bg-amber-500",
      };
    case "Last rollout rolled back":
      return {
        colorClass: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
        dotClass: "bg-rose-500",
      };
    case "Adapter error":
      return {
        colorClass: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
        dotClass: "bg-red-600",
      };
    case "Connected, no rollouts yet":
      return {
        colorClass: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
        dotClass: "bg-blue-500",
      };
    case "Not verified":
      return {
        colorClass: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800",
        dotClass: "bg-yellow-500",
      };
    case "Not connected":
    default:
      return {
        colorClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        dotClass: "bg-slate-400",
      };
  }
}

/**
 * Agent operational status derived from last heartbeat, host verification, and revocation state.
 */
export type AgentStatus = "online" | "offline" | "never-installed" | "revoked" | "colocated";

export interface AgentStatusInput {
  agentLastHeartbeat?: Date | string | null;
  agentRevoked?: boolean | null;
  isVerified?: boolean;
  now?: Date | number;
}

/**
 * Derives agent status:
 * - "revoked": if agentRevoked is true
 * - "online": if agent sent a heartbeat within the last 5 minutes
 * - "offline": if last heartbeat was more than 5 minutes ago
 * - "colocated": if verified on host without a remote agent heartbeat
 * - "never-installed": if agent was never installed and host unverified
 */
export function deriveAgentStatus(input: AgentStatusInput): AgentStatus {
  if (input.agentRevoked) {
    return "revoked";
  }
  if (input.agentLastHeartbeat) {
    const lastMs = new Date(input.agentLastHeartbeat).getTime();
    if (!isNaN(lastMs)) {
      const currentMs = typeof input.now === "number" ? input.now : input.now ? new Date(input.now).getTime() : Date.now();
      const diffMs = currentMs - lastMs;

      // 5 minutes threshold
      if (diffMs <= 5 * 60 * 1000) {
        return "online";
      }

      return "offline";
    }
  }

  if (input.isVerified) {
    return "colocated";
  }

  return "never-installed";
}

export function getAgentBadgeVariant(status: AgentStatus): {
  label: string;
  colorClass: string;
  dotClass: string;
} {
  switch (status) {
    case "online":
      return {
        label: "Agent Online",
        colorClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        dotClass: "bg-emerald-500",
      };
    case "colocated":
      return {
        label: "Host Connected",
        colorClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        dotClass: "bg-emerald-500",
      };
    case "offline":
      return {
        label: "Agent Offline",
        colorClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
        dotClass: "bg-amber-500",
      };
    case "revoked":
      return {
        label: "Agent Revoked",
        colorClass: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
        dotClass: "bg-rose-500",
      };
    case "never-installed":
    default:
      return {
        label: "Agent Not Installed",
        colorClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        dotClass: "bg-slate-400",
      };
  }
}
