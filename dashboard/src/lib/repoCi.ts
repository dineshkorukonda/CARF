import { mintInstallationToken } from "./installationAccess";
import type { CiSnapshot } from "./ciStatus";

type Entry = { value?: CiSnapshot; expires: number; pending?: Promise<CiSnapshot> };
const cache = new Map<string, Entry>();
const tokens = new Map<string, { token: Promise<string>; expires: number }>();
const unavailable: CiSnapshot = { headSha: null, runs: {}, unavailable: true };

export function invalidateRepoCi(installationId: string, owner: string, repo: string, branch: string): void {
  cache.delete(JSON.stringify([installationId, owner.toLowerCase(), repo.toLowerCase(), branch]));
}

// Scope by installation as well as repository. Concurrent viewers share one request.
// GitHub is refreshed at most every 10s; rollout polling never mints a token per tick.
export async function getRepoCi(installationId: string, owner: string, repo: string, branch: string): Promise<CiSnapshot> {
  const key = JSON.stringify([installationId, owner.toLowerCase(), repo.toLowerCase(), branch]);
  let entry = cache.get(key);
  if (entry && entry.expires > Date.now() && entry.value) return entry.value;
  if (entry?.pending) return entry.value ?? entry.pending;
  if (!entry) {
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    entry = { expires: 0 };
    cache.set(key, entry);
  }
  const current = entry;
  current.pending = (async () => {
    try {
      let tokenEntry = tokens.get(installationId);
      if (!tokenEntry || tokenEntry.expires <= Date.now()) {
        if (tokens.size >= 200) tokens.delete(tokens.keys().next().value!);
        tokenEntry = { token: mintInstallationToken(installationId), expires: Date.now() + 40 * 60_000 };
        tokens.set(installationId, tokenEntry);
      }
      const token = await tokenEntry.token;
      const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      const read = async (path: string) => {
        const response = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(6000), cache: "no-store" });
        if (!response.ok) throw new Error("GitHub unavailable");
        return response.json();
      };
      const [history, tip] = await Promise.all([
        read(`actions/runs?branch=${encodeURIComponent(branch)}&per_page=100`),
        read(`branches/${encodeURIComponent(branch)}`),
      ]);
      const value: CiSnapshot = { headSha: tip.commit.sha, runs: {}, deployments: {}, unavailable: false };
      for (const run of history.workflow_runs) {
        if (run.name === "CARF PM2 Deployment" && run.event === "workflow_run") {
          // workflow_run.head_sha points to the workflow ref, not necessarily its deployed candidate.
          const candidate = /^CARF PM2 deploy ([0-9a-f]{40})$/.exec(run.display_title)?.[1];
          if (candidate && !value.deployments![candidate]) value.deployments![candidate] = {
            id: run.id, status: run.status, conclusion: run.conclusion,
            url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${run.id}`,
          };
          continue;
        }
        if (run.name !== "CI" || run.event !== "push") continue;
        // API orders latest runs first; keep the most recent run for each SHA.
        if (!value.runs[run.head_sha]) value.runs[run.head_sha] = {
          id: run.id, status: run.status, conclusion: run.conclusion,
          url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${run.id}`,
        };
      }
      current.value = value;
      current.expires = Date.now() + 10_000;
      return value;
    } catch {
      tokens.delete(installationId);
      current.value = { ...(current.value ?? unavailable), unavailable: true };
      current.expires = Date.now() + 30_000;
      return current.value;
    } finally { current.pending = undefined; }
  })();
  return current.value ?? current.pending;
}
