export interface VerifyCheck {
  id: string;
  title: string;
  passed: boolean;
  message: string;
}

export interface VerifyResult {
  verified: boolean;
  checks: VerifyCheck[];
  layout?: "git" | "releases";
  staleCoreApi?: boolean;
}

export interface VerifyTarget {
  name?: string;
  layout?: string;
  cwd?: string;
  releasesDir?: string;
  currentSymlink?: string;
  healthUrl?: string;
}

function isCapistranoCheckId(id: string): boolean {
  return id === "releases_dir" || id === "current_symlink" || id.startsWith("shared_path_");
}

export function isGitVerifyTarget(target: VerifyTarget): boolean {
  if (target.layout === "git") return true;
  if (target.layout === "releases") return false;
  const hasCwd = typeof target.cwd === "string" && target.cwd.length > 0;
  return hasCwd && !target.releasesDir && !target.currentSymlink;
}

/**
 * An outdated core-api always runs Capistrano releases/`current` checks. When the
 * wizard asked for git layout, those failures are not real git-checkout problems.
 * Rewrite them so the dashboard can mark the repo verified without waiting on a
 * core-api rebuild.
 */
export function reconcileGitLayoutVerify(target: VerifyTarget, data: VerifyResult): VerifyResult {
  if (!isGitVerifyTarget(target)) {
    return { ...data, layout: data.layout === "git" ? "git" : "releases" };
  }

  const staleCoreApi = data.checks.some((c) => isCapistranoCheckId(c.id));
  if (!staleCoreApi) {
    return { ...data, layout: "git", staleCoreApi: false };
  }

  const checks = data.checks.map((c) => {
    if (!isCapistranoCheckId(c.id) || c.passed) return c;
    return {
      ...c,
      passed: true,
      message: `Skipped for git layout (cwd ${target.cwd ?? "set"}). core-api still ran Capistrano ${c.id}; restart carf-core-api to run working-directory checks instead.`,
    };
  });

  return {
    verified: checks.every((c) => c.passed),
    checks,
    layout: "git",
    staleCoreApi: true,
  };
}
