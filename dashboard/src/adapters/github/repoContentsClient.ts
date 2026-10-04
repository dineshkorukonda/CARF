import type { FetchFn } from "./fetchTypes";

const GITHUB_API_BASE = "https://api.github.com";

export type GitHubFailureCode =
  | "not_installed"
  | "repo_inaccessible"
  | "insufficient_permission"
  | "branch_protected"
  | "rate_limited"
  | "github_unavailable";

/**
 * Failure from the GitHub API, already classified. `message` is safe to show users; the raw
 * response body is kept in `detail` for server-side logging only (never sent to a client).
 */
export class GitHubApiError extends Error {
  constructor(
    public readonly code: GitHubFailureCode,
    public readonly status: number,
    message: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function failure(response: { status: number; text(): Promise<string>; ok: boolean }, action: string): Promise<GitHubApiError> {
  const body = await response.text().catch(() => "");
  const lower = body.toLowerCase();
  if (response.status === 429 || (response.status === 403 && lower.includes("rate limit"))) {
    return new GitHubApiError("rate_limited", response.status, "GitHub API rate limit reached. Try again in a few minutes.", body);
  }
  if (response.status === 404) {
    return new GitHubApiError(
      "repo_inaccessible",
      404,
      "The repository is not accessible to the CARF GitHub App. Confirm the app is installed on this repository.",
      body
    );
  }
  if (response.status === 403 || response.status === 401) {
    if (lower.includes("workflow")) {
      return new GitHubApiError(
        "insufficient_permission",
        response.status,
        "GitHub Actions integration could not be installed because the GitHub App does not have permission to modify workflow files. Grant the app 'Workflows: Read and write' and accept the updated permissions.",
        body
      );
    }
    return new GitHubApiError(
      "insufficient_permission",
      response.status,
      `The CARF GitHub App lacks the permission needed to ${action}. Update the app's repository permissions (Contents, Workflows, Secrets) and accept them on the installation.`,
      body
    );
  }
  if (response.status === 409 || response.status === 422) {
    if (lower.includes("protected") || lower.includes("rule") || lower.includes("review")) {
      return new GitHubApiError(
        "branch_protected",
        response.status,
        "Branch protection prevents CARF from committing the workflow. Allow the CARF GitHub App to bypass branch protection, or add the workflow via a pull request.",
        body
      );
    }
  }
  return new GitHubApiError("github_unavailable", response.status, `GitHub returned an unexpected error while trying to ${action}.`, body);
}

async function call(fetchFn: FetchFn, url: string, init: RequestInit): Promise<Awaited<ReturnType<FetchFn>>> {
  try {
    return await fetchFn(url, init);
  } catch (error) {
    throw new GitHubApiError(
      "github_unavailable",
      0,
      "Could not reach the GitHub API.",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export interface RepoInfo {
  defaultBranch: string;
  fullName: string;
}

/** CI-gated PM2 deployment currently requires an active workflow named CI. */
export async function hasDeploymentCi(token: string, owner: string, repo: string, fetchFn: FetchFn = fetch): Promise<boolean> {
  for (let page = 1; page <= 10; page++) {
    const res = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows?per_page=100&page=${page}`, { headers: headers(token) });
    if (!res.ok) throw await failure(res, "read CI workflows (Actions: Read)");
    const body = await res.json() as { workflows: Array<{ name: string; state: string }> };
    if (body.workflows.some((workflow) => workflow.name === "CI" && workflow.state === "active")) return true;
    if (body.workflows.length < 100) return false;
  }
  return false;
}

export async function getRepository(token: string, owner: string, repo: string, fetchFn: FetchFn = fetch): Promise<RepoInfo> {
  const res = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers: headers(token) });
  if (!res.ok) throw await failure(res, "read the repository");
  const body = (await res.json()) as { default_branch: string; full_name: string };
  return { defaultBranch: body.default_branch, fullName: body.full_name };
}

export async function getHeadSha(token: string, owner: string, repo: string, branch: string, fetchFn: FetchFn = fetch): Promise<string> {
  const res = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`, {
    headers: headers(token),
  });
  if (!res.ok) throw await failure(res, "read the latest commit");
  return ((await res.json()) as { sha: string }).sha;
}

export interface RepoFile {
  sha: string;
  content: string;
}

/** Returns null if the file does not exist on `ref`. */
export async function getFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
  fetchFn: FetchFn = fetch
): Promise<RepoFile | null> {
  const res = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, {
    headers: headers(token),
  });
  if (res.status === 404) {
    // 404 is ambiguous: missing file vs. inaccessible repo. getRepository() runs first in the
    // service, so by here the repo is known to be accessible.
    return null;
  }
  if (!res.ok) throw await failure(res, "read the workflow file");
  const body = (await res.json()) as { sha: string; content: string; encoding: string };
  return { sha: body.sha, content: Buffer.from(body.content, "base64").toString("utf8") };
}

export async function putFile(
  token: string,
  owner: string,
  repo: string,
  args: { path: string; content: string; message: string; branch: string; sha?: string },
  fetchFn: FetchFn = fetch
): Promise<void> {
  const res = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${args.path}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify({
      message: args.message,
      content: Buffer.from(args.content, "utf8").toString("base64"),
      branch: args.branch,
      ...(args.sha ? { sha: args.sha } : {}),
    }),
  });
  if (!res.ok) throw await failure(res, "write the workflow file");
}

export async function deleteFile(
  token: string,
  owner: string,
  repo: string,
  args: { path: string; message: string; branch: string; sha: string },
  fetchFn: FetchFn = fetch
): Promise<void> {
  const res = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${args.path}`, {
    method: "DELETE",
    headers: headers(token),
    body: JSON.stringify({ message: args.message, branch: args.branch, sha: args.sha }),
  });
  if (!res.ok) throw await failure(res, "remove the workflow file");
}

/** Permissions the CARF GitHub App holds on an installation (needs an App JWT, not an installation token). */
export async function getInstallationPermissions(
  appJwt: string,
  installationId: string,
  fetchFn: FetchFn = fetch
): Promise<Record<string, string>> {
  const res = await call(fetchFn, `${GITHUB_API_BASE}/app/installations/${installationId}`, { headers: headers(appJwt) });
  if (res.status === 404) {
    throw new GitHubApiError("not_installed", 404, "The CARF GitHub App is not installed for this account.");
  }
  if (!res.ok) throw await failure(res, "read the app installation");
  return ((await res.json()) as { permissions?: Record<string, string> }).permissions ?? {};
}

/** True when the named Actions repository secret exists (value is never readable). */
export async function actionsSecretExists(
  token: string,
  owner: string,
  repo: string,
  name: string,
  fetchFn: FetchFn = fetch
): Promise<boolean> {
  const res = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/secrets/${name}`, { headers: headers(token) });
  if (res.status === 404) return false;
  if (!res.ok) throw await failure(res, "read the repository secret");
  return true;
}

/** Encrypts `value` with the repo's public key (libsodium sealed box) and stores it as an Actions secret. */
export async function setActionsSecret(
  token: string,
  owner: string,
  repo: string,
  name: string,
  value: string,
  fetchFn: FetchFn = fetch
): Promise<void> {
  const keyRes = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/secrets/public-key`, {
    headers: headers(token),
  });
  if (!keyRes.ok) throw await failure(keyRes, "configure the repository secret");
  const { key, key_id: keyId } = (await keyRes.json()) as { key: string; key_id: string };

  const sodium = (await import("libsodium-wrappers")).default;
  await sodium.ready;
  const publicKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), publicKey);
  const encrypted = sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);

  const putRes = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/secrets/${name}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify({ encrypted_value: encrypted, key_id: keyId }),
  });
  if (!putRes.ok) throw await failure(putRes, "configure the repository secret");
}

export async function deleteActionsSecret(
  token: string,
  owner: string,
  repo: string,
  name: string,
  fetchFn: FetchFn = fetch
): Promise<void> {
  const res = await call(fetchFn, `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/secrets/${name}`, {
    method: "DELETE",
    headers: headers(token),
  });
  if (res.status === 404) return;
  if (!res.ok) throw await failure(res, "remove the repository secret");
}
