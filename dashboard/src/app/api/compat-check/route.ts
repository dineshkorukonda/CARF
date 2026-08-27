import { NextRequest, NextResponse } from "next/server";
import { fetchPublicRepoTree, RepoNotFoundError } from "../../../adapters/github/publicRepoTreeClient";
import { evaluateCompatibility } from "../../../lib/compatCheck";

function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$|^([\w.-]+)\/([\w.-]+?)$/);
  if (!match) return null;
  const owner = match[1] ?? match[3];
  const repo = match[2] ?? match[4];
  return owner && repo ? { owner, repo } : null;
}

/**
 * Public, unauthenticated compatibility check for the dashboard's landing page (issue:
 * "will CARF integrate with my project" self-check). No GitHub App install or login
 * required -- it only reads a public repo's file paths and runs them through
 * lib/compatCheck.ts's pure signal matching.
 */
export async function POST(request: NextRequest) {
  let body: { repoUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (typeof body.repoUrl !== "string" || body.repoUrl.trim().length === 0) {
    return NextResponse.json({ error: "missing repoUrl" }, { status: 400 });
  }

  const parsed = parseRepoUrl(body.repoUrl);
  if (!parsed) {
    return NextResponse.json({ error: "Enter a GitHub repo as owner/repo or a github.com URL." }, { status: 400 });
  }

  try {
    const tree = await fetchPublicRepoTree(parsed.owner, parsed.repo);

    if (tree.isPrivate) {
      return NextResponse.json({
        owner: parsed.owner,
        repo: parsed.repo,
        private: true,
        summary: `${parsed.owner}/${parsed.repo} is private, so it can't be scanned without installing the CARF GitHub App first. Sign in and install the App on it — the check isn't needed at that point, since installing is what actually connects CARF.`,
      });
    }

    const report = evaluateCompatibility(tree.paths);
    return NextResponse.json({
      owner: parsed.owner,
      repo: parsed.repo,
      private: false,
      truncated: tree.truncated,
      ...report,
    });
  } catch (err) {
    if (err instanceof RepoNotFoundError) {
      return NextResponse.json(
        { error: `${parsed.owner}/${parsed.repo} wasn't found. Check the URL, or it may be private.` },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: "Couldn't reach GitHub — try again in a moment." }, { status: 502 });
  }
}
