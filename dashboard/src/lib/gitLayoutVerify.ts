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

function isSkippableGitLayoutCheckId(id: string): boolean {
  return isCapistranoCheckId(id) || id === "git_metadata";
}

/**
 * An outdated core-api always runs Capistrano releases/`current` checks. When the
 * wizard asked for git layout, those failures are not real git-checkout problems.
 * A missing nested .git also must not block verify — many deploys are copies, not clones.
 */
export function reconcileGitLayoutVerify(target: VerifyTarget, data: VerifyResult): VerifyResult {
  if (!isGitVerifyTarget(target)) {
    return { ...data, layout: data.layout === "git" ? "git" : "releases" };
  }

  const needsRewrite = data.checks.some((c) => isSkippableGitLayoutCheckId(c.id) && !c.passed);
  const staleCoreApi = data.checks.some((c) => isCapistranoCheckId(c.id));
  if (!needsRewrite) {
    return { ...data, layout: "git", staleCoreApi };
  }

  const checks = data.checks.map((c) => {
    if (!isSkippableGitLayoutCheckId(c.id) || c.passed) return c;
    const reason =
      c.id === "git_metadata"
        ? `Git metadata is optional for connection verify (cwd ${target.cwd ?? "set"}).`
        : `Skipped for git layout (cwd ${target.cwd ?? "set"}). core-api still ran Capistrano ${c.id}.`;
    return { ...c, passed: true, message: reason };
  });

  return {
    verified: checks.every((c) => c.passed),
    checks,
    layout: "git",
    staleCoreApi,
  };
}
