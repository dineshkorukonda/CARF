import type { FetchFn } from "./fetchTypes";
import { signGithubAppJwt } from "./appInstallClient";
import { createInstallationToken } from "./installationTokenClient";
import { listInstallationRepos } from "./reposClient";

const GITHUB_API_BASE = "https://api.github.com";

export interface AppProbeEnv {
  appId: string;
  appSlug: string;
  privateKey: string;
  coreApiBaseUrl?: string;
}

export interface GithubAppDetails {
  id: number;
  slug: string;
  name: string;
  owner: { login: string; type: string };
  permissions: Record<string, string>;
  events: string[];
}

export interface GithubAppInstallationItem {
  id: number;
  account: { login: string; type: string };
  repository_selection: string;
  html_url?: string;
}

export type CheckStatus = "ok" | "warning" | "error" | "skipped";

export interface CheckResult {
  status: CheckStatus;
  latencyMs?: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface ProbeReport {
  overallStatus: "healthy" | "degraded" | "failed";
  timestamp: string;
  checks: {
    credentials: CheckResult & { appId?: string; appSlug?: string };
    githubApp: CheckResult & {
      appName?: string;
      appSlug?: string;
      slugMismatch?: boolean;
      owner?: string;
      permissions?: Record<string, string>;
    };
    installations: CheckResult & {
      totalOnGithub?: number;
      accounts?: string[];
      installations?: { id: number; account: string }[];
    };
    accountSync: CheckResult & {
      linkedCount: number;
      unlinkedOnGithub: number;
      unlinkedInstallationIds: number[];
    };
    tokenAndRepos: CheckResult & {
      accessibleRepos?: string[];
      repoCount?: number;
    };
    coreApi?: CheckResult;
  };
  recommendations: string[];
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function fetchAppDetails(
  appJwt: string,
  fetchFn: FetchFn = fetch
): Promise<GithubAppDetails> {
  const response = await fetchFn(`${GITHUB_API_BASE}/app`, {
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub app details fetch failed (status ${response.status}): ${body}`);
  }

  return (await response.json()) as GithubAppDetails;
}

export async function listAppInstallations(
  appJwt: string,
  fetchFn: FetchFn = fetch
): Promise<GithubAppInstallationItem[]> {
  const response = await fetchFn(`${GITHUB_API_BASE}/app/installations`, {
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub installations fetch failed (status ${response.status}): ${body}`);
  }

  return (await response.json()) as GithubAppInstallationItem[];
}

export async function runGithubAppProbe({
  env,
  localInstallationIds = [],
  fetchFn = fetch,
}: {
  env: AppProbeEnv;
  localInstallationIds?: string[];
  fetchFn?: FetchFn;
}): Promise<ProbeReport> {
  const recommendations: string[] = [];

  // Stage 1: Credentials & JWT Signing
  let appJwt: string | null = null;
  let credentialsCheck: CheckResult & { appId?: string; appSlug?: string };

  const t0 = Date.now();
  try {
    if (!env.appId || !env.privateKey) {
      throw new Error("Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY");
    }
    appJwt = signGithubAppJwt(env.appId, env.privateKey);
    credentialsCheck = {
      status: "ok",
      latencyMs: Date.now() - t0,
      message: `App credentials validated. Signed RS256 JWT for App ID ${env.appId}.`,
      appId: env.appId,
      appSlug: env.appSlug,
    };
  } catch (err: unknown) {
    credentialsCheck = {
      status: "error",
      latencyMs: Date.now() - t0,
      message: `Failed to sign GitHub App JWT: ${getErrorMessage(err)}`,
      appId: env.appId,
      appSlug: env.appSlug,
    };
    recommendations.push(
      "Verify GITHUB_APP_ID and ensure GITHUB_APP_PRIVATE_KEY contains a valid multi-line RSA PEM key with newlines."
    );
  }

  // Stage 2: GitHub App Metadata (/app)
  let githubAppCheck: CheckResult & {
    appName?: string;
    appSlug?: string;
    slugMismatch?: boolean;
    owner?: string;
    permissions?: Record<string, string>;
  } = {
    status: "skipped",
    message: "Skipped due to credentials failure.",
  };

  let appDetails: GithubAppDetails | null = null;
  if (appJwt) {
    const t1 = Date.now();
    try {
      appDetails = await fetchAppDetails(appJwt, fetchFn);
      const slugMismatch = env.appSlug && appDetails.slug !== env.appSlug;

      if (slugMismatch) {
        githubAppCheck = {
          status: "warning",
          latencyMs: Date.now() - t1,
          slugMismatch: true,
          appName: appDetails.name,
          appSlug: appDetails.slug,
          owner: appDetails.owner?.login,
          permissions: appDetails.permissions,
          message: `GitHub App verified as "${appDetails.name}" (${appDetails.owner?.login}), but slug mismatch: env has "${env.appSlug}" while GitHub slug is "${appDetails.slug}".`,
        };
        recommendations.push(
          `Update GITHUB_APP_SLUG in your environment variables from "${env.appSlug}" to "${appDetails.slug}".`
        );
      } else {
        githubAppCheck = {
          status: "ok",
          latencyMs: Date.now() - t1,
          slugMismatch: false,
          appName: appDetails.name,
          appSlug: appDetails.slug,
          owner: appDetails.owner?.login,
          permissions: appDetails.permissions,
          message: `Connected to GitHub App "${appDetails.name}" (owned by ${appDetails.owner?.login}). Slug: "${appDetails.slug}".`,
        };
      }
    } catch (err: unknown) {
      githubAppCheck = {
        status: "error",
        latencyMs: Date.now() - t1,
        message: `Failed to connect to GitHub API: ${getErrorMessage(err)}`,
      };
      recommendations.push(
        "Check that GITHUB_APP_ID matches the App on GitHub and that the private key belongs to this exact App ID."
      );
    }
  }

  // Stage 3: Installations on GitHub (/app/installations)
  let installationsCheck: CheckResult & {
    totalOnGithub?: number;
    accounts?: string[];
    installations?: { id: number; account: string }[];
  } = {
    status: "skipped",
    message: "Skipped due to GitHub API failure.",
  };

  let githubInstallations: GithubAppInstallationItem[] = [];
  if (appJwt && appDetails) {
    const t2 = Date.now();
    try {
      githubInstallations = await listAppInstallations(appJwt, fetchFn);
      const accounts = githubInstallations.map((i) => i.account?.login ?? `id:${i.id}`);
      const summaryList = githubInstallations.map((i) => ({
        id: i.id,
        account: i.account?.login ?? "unknown",
      }));

      if (githubInstallations.length === 0) {
        installationsCheck = {
          status: "warning",
          latencyMs: Date.now() - t2,
          totalOnGithub: 0,
          accounts: [],
          installations: [],
          message: "App is active on GitHub, but has not been installed on any user or organization account yet.",
        };
        recommendations.push(
          "Install the GitHub App on your account via GitHub settings (https://github.com/settings/apps -> Install App) or via the install link."
        );
      } else {
        installationsCheck = {
          status: "ok",
          latencyMs: Date.now() - t2,
          totalOnGithub: githubInstallations.length,
          accounts,
          installations: summaryList,
          message: `Found ${githubInstallations.length} active installation(s) on GitHub: ${accounts.join(", ")}.`,
        };
      }
    } catch (err: unknown) {
      installationsCheck = {
        status: "error",
        latencyMs: Date.now() - t2,
        message: `Failed to fetch installations from GitHub: ${getErrorMessage(err)}`,
      };
    }
  }

  // Stage 4: Database Account Sync
  const unlinked = githubInstallations.filter(
    (i) => !localInstallationIds.includes(String(i.id))
  );

  let accountSyncCheck: CheckResult & {
    linkedCount: number;
    unlinkedOnGithub: number;
    unlinkedInstallationIds: number[];
  };

  if (githubInstallations.length > 0) {
    if (unlinked.length > 0) {
      accountSyncCheck = {
        status: "warning",
        linkedCount: localInstallationIds.length,
        unlinkedOnGithub: unlinked.length,
        unlinkedInstallationIds: unlinked.map((i) => i.id),
        message: `Found ${unlinked.length} installation(s) on GitHub (${unlinked.map((i) => `${i.account?.login} [ID: ${i.id}]`).join(", ")}) not yet linked to your dashboard account.`,
      };
      recommendations.push(
        `Link installation ID ${unlinked[0]?.id} using the "Link Installation" input in the dashboard.`
      );
    } else {
      accountSyncCheck = {
        status: "ok",
        linkedCount: localInstallationIds.length,
        unlinkedOnGithub: 0,
        unlinkedInstallationIds: [],
        message: `All ${localInstallationIds.length} installation(s) on GitHub are linked to your dashboard account.`,
      };
    }
  } else {
    accountSyncCheck = {
      status: localInstallationIds.length > 0 ? "ok" : "warning",
      linkedCount: localInstallationIds.length,
      unlinkedOnGithub: 0,
      unlinkedInstallationIds: [],
      message: localInstallationIds.length > 0
        ? `${localInstallationIds.length} installation(s) registered in dashboard database.`
        : "No installations linked to this account yet.",
    };
  }

  // Stage 5: Token Minting & Repositories Probe
  let tokenAndReposCheck: CheckResult & {
    accessibleRepos?: string[];
    repoCount?: number;
  } = {
    status: "skipped",
    message: "Skipped (no installation available to test token minting).",
  };

  const targetInstallId = localInstallationIds[0] ?? (githubInstallations[0] ? String(githubInstallations[0].id) : null);
  if (appJwt && targetInstallId) {
    const t3 = Date.now();
    try {
      const { token } = await createInstallationToken(targetInstallId, appJwt, fetchFn);
      const repos = await listInstallationRepos(token, fetchFn);
      const repoNames = repos.map((r) => r.full_name);

      tokenAndReposCheck = {
        status: "ok",
        latencyMs: Date.now() - t3,
        repoCount: repos.length,
        accessibleRepos: repoNames,
        message: `Successfully minted installation token for ID ${targetInstallId}. Access verified to ${repos.length} repository(ies): ${repoNames.slice(0, 3).join(", ")}${repos.length > 3 ? "..." : ""}.`,
      };
    } catch (err: unknown) {
      tokenAndReposCheck = {
        status: "error",
        latencyMs: Date.now() - t3,
        message: `Failed to mint installation token or read repositories for ID ${targetInstallId}: ${getErrorMessage(err)}`,
      };
      recommendations.push(
        `Ensure the GitHub App has 'Repository permissions: Contents (Read-only)' and 'Metadata (Read-only)'.`
      );
    }
  }

  // Stage 6: Core API Health Probe
  let coreApiCheck: CheckResult | undefined = undefined;
  if (env.coreApiBaseUrl) {
    const t4 = Date.now();
    try {
      let res = await fetchFn(`${env.coreApiBaseUrl}/health`);
      if (!res.ok) {
        res = await fetchFn(`${env.coreApiBaseUrl}/healthz`);
      }
      if (res.ok) {
        coreApiCheck = {
          status: "ok",
          latencyMs: Date.now() - t4,
          message: `Core API decision service is healthy at ${env.coreApiBaseUrl}.`,
        };
      } else {
        coreApiCheck = {
          status: "warning",
          latencyMs: Date.now() - t4,
          message: `Core API returned status ${res.status} on /health.`,
        };
      }
    } catch (err: unknown) {
      coreApiCheck = {
        status: "warning",
        latencyMs: Date.now() - t4,
        message: `Could not reach Core API at ${env.coreApiBaseUrl}: ${getErrorMessage(err)}`,
      };
    }
  }

  // Determine overall status
  const statuses = [
    credentialsCheck.status,
    githubAppCheck.status,
    installationsCheck.status,
    tokenAndReposCheck.status,
  ];

  let overallStatus: "healthy" | "degraded" | "failed" = "healthy";
  if (statuses.includes("error")) {
    overallStatus = "failed";
  } else if (statuses.includes("warning") || (coreApiCheck && coreApiCheck.status === "warning")) {
    overallStatus = "degraded";
  }

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    checks: {
      credentials: credentialsCheck,
      githubApp: githubAppCheck,
      installations: installationsCheck,
      accountSync: accountSyncCheck,
      tokenAndRepos: tokenAndReposCheck,
      ...(coreApiCheck ? { coreApi: coreApiCheck } : {}),
    },
    recommendations,
  };
}
