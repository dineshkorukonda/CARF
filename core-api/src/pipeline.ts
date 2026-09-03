import { prisma as defaultPrisma } from "./db/client.js";
import type { CodeFile } from "./classifier/codeComplexityScorer.js";
import type { UserPatternRule } from "./classifier/tier1.js";
import { classifyCommit } from "./classifier/vector.js";
import { computeThreshold, DEFAULT_CONFIG, type ThresholdConfig, type ThresholdResult } from "./threshold/engine.js";

/**
 * Thrown when `processCommit()` is called with an empty `changedFiles` array. There is
 * nothing to classify or persist in that case, so we fail fast with a typed error rather
 * than silently no-op-ing or fabricating a zero-signal Commit row.
 */
export class EmptyChangeSetError extends Error {
  constructor(sha: string) {
    super(`processCommit: changedFiles is empty for commit ${sha} — nothing to classify`);
    this.name = "EmptyChangeSetError";
  }
}

/**
 * Thrown when `repo` isn't in the expected "owner/repo" slug form. `processCommit()`'s
 * `repo` parameter is a single string but the `Commit` model (see prisma/schema.prisma,
 * from PR #26) stores `owner` and `repo` as separate required columns with a
 * `@@unique([owner, repo, sha])` constraint, so we require and split a GitHub-style
 * "owner/repo" slug rather than silently defaulting owner to an empty string.
 */
export class InvalidRepoSlugError extends Error {
  constructor(repo: string) {
    super(`processCommit: expected repo in "owner/repo" form, got "${repo}"`);
    this.name = "InvalidRepoSlugError";
  }
}

/**
 * Thrown when `classifyCommit()` returns `null` for a (non-empty) `changedFiles` array —
 * i.e. every changed file was "unclassified" (docs, images, etc.), so there is no signal
 * to compute a threshold from. Per core-api/CLAUDE.md, `null` from `classifyCommit()`
 * must never be coerced into a zero vector.
 *
 * Decision (documented per issue #11): we still persist the `Commit` row — a commit did
 * happen and that fact is useful for auditing/history — but we skip `ChangeVector` and
 * `Threshold` persistence entirely (there's nothing meaningful to store) and surface this
 * as a typed error so callers can distinguish "no signal, working as intended" from a
 * genuine failure, instead of silently returning a sentinel `ThresholdResult` that could
 * be mistaken for a real (if permissive) computed value.
 */
export class NoSignalError extends Error {
  constructor(sha: string) {
    super(
      `processCommit: classifyCommit() returned null (no signal) for commit ${sha} — ` +
        `Commit row was persisted, but ChangeVector/Threshold were not`
    );
    this.name = "NoSignalError";
  }
}

/**
 * Minimal seam over the subset of PrismaClient's API `processCommit()` needs. Real
 * `PrismaClient` (see src/db/client.ts) satisfies this structurally; tests inject an
 * in-memory fake instead so pipeline control flow can be unit-tested without a live
 * Postgres (see test/pipeline.test.ts) — DB-dependent behavior is separately covered by
 * live-DB tests guarded the same way test/db/crud.test.ts is.
 */
export interface PipelinePrismaClient {
  commit: {
    upsert(args: {
      where: { owner_repo_sha: { owner: string; repo: string; sha: string } };
      create: { owner: string; repo: string; sha: string; baseSha: string; installationId?: string | undefined };
      update: Record<string, never>;
    }): Promise<{ id: string }>;
  };
  changeVector: {
    upsert(args: {
      where: { commitId: string };
      create: {
        commitId: string;
        infra: number;
        dependency: number;
        config: number;
        code: number;
        data: number;
        codeComplexity: number;
      };
      update: {
        infra: number;
        dependency: number;
        config: number;
        code: number;
        data: number;
        codeComplexity: number;
      };
    }): Promise<unknown>;
  };
  threshold: {
    upsert(args: {
      where: { commitId: string };
      create: { commitId: string; finalThreshold: number; finalWindow: number; activeTypes: string[] };
      update: { finalThreshold: number; finalWindow: number; activeTypes: string[] };
    }): Promise<unknown>;
  };
}

export interface ProcessCommitOptions {
  /** Injected Prisma client seam; defaults to the app-wide singleton (src/db/client.ts). */
  prismaClient?: PipelinePrismaClient | undefined;
  /** Threshold engine tuning; defaults to DEFAULT_CONFIG (src/threshold/engine.ts). */
  thresholdConfig?: ThresholdConfig | undefined;
  /** Real base SHA from a webhook payload. Defaults to "" (today's exact prior behavior)
   *  when not supplied. */
  baseSha?: string | undefined;
  /** Real GitHub App installation ID from a webhook payload. Omitted (undefined) by
   *  default, matching the Commit model's nullable installationId column. */
  installationId?: string | undefined;
  /** User classification rules (from .carf.yml), checked before Tier 1's hardcoded
   *  rules — mirrors the identical option already threaded through
   *  evaluation/runHarness.ts's RunEvaluationOptions. Defaults to none. */
  classificationRules?: UserPatternRule[];
}

function splitRepoSlug(repoSlug: string): { owner: string; repo: string } {
  const separatorIndex = repoSlug.indexOf("/");
  if (separatorIndex <= 0 || separatorIndex === repoSlug.length - 1) {
    throw new InvalidRepoSlugError(repoSlug);
  }
  return {
    owner: repoSlug.slice(0, separatorIndex),
    repo: repoSlug.slice(separatorIndex + 1),
  };
}

/**
 * Wires classifier output through persistence to the threshold engine for a single
 * commit:
 *   1. classifyCommit() (src/classifier/vector.ts) -> ChangeVector | null
 *   2. upsert Commit (+ ChangeVector, if signal) via Prisma
 *   3. computeThreshold() (src/threshold/engine.ts) -> ThresholdResult
 *   4. upsert Threshold via Prisma
 *   5. return the ThresholdResult
 *
 * Idempotent: re-running with the same (owner, repo, sha) upserts existing rows rather
 * than creating duplicates, keyed on the Commit model's `@@unique([owner, repo, sha])`
 * and the ChangeVector/Threshold models' `commitId @unique` 1:1 relations.
 *
 * @param sha Commit SHA.
 * @param repo "owner/repo" slug, e.g. "acme/widgets". Split into the Commit model's
 *   separate `owner`/`repo` columns — see InvalidRepoSlugError.
 * @param changedFiles Files touched by the commit, each with before/after content.
 * @param options.baseSha Real base SHA from a webhook payload; defaults to "".
 * @param options.installationId Real GitHub App installation ID; omitted by default.
 * @param options.classificationRules .carf.yml classification.rules, checked before
 *   Tier 1's hardcoded rules; defaults to none.
 * @throws EmptyChangeSetError if changedFiles is empty.
 * @throws InvalidRepoSlugError if repo isn't in "owner/repo" form.
 * @throws NoSignalError if classifyCommit() returns null (see class doc above).
 */
export async function processCommit(
  sha: string,
  repo: string,
  changedFiles: CodeFile[],
  options: ProcessCommitOptions = {}
): Promise<ThresholdResult> {
  if (changedFiles.length === 0) {
    throw new EmptyChangeSetError(sha);
  }

  const { owner, repo: repoName } = splitRepoSlug(repo);
  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as PipelinePrismaClient);

  const vector = classifyCommit(changedFiles, undefined, options.classificationRules ?? []);

  const commit = await prismaClient.commit.upsert({
    where: { owner_repo_sha: { owner, repo: repoName, sha } },
    create: { owner, repo: repoName, sha, baseSha: options.baseSha ?? "", installationId: options.installationId },
    update: {},
  });

  if (vector === null) {
    throw new NoSignalError(sha);
  }

  await prismaClient.changeVector.upsert({
    where: { commitId: commit.id },
    create: {
      commitId: commit.id,
      infra: vector.infra,
      dependency: vector.dependency,
      config: vector.config,
      code: vector.code,
      data: vector.data,
      codeComplexity: vector.code_complexity,
    },
    update: {
      infra: vector.infra,
      dependency: vector.dependency,
      config: vector.config,
      code: vector.code,
      data: vector.data,
      codeComplexity: vector.code_complexity,
    },
  });

  const result = computeThreshold(vector, options.thresholdConfig ?? DEFAULT_CONFIG);

  await prismaClient.threshold.upsert({
    where: { commitId: commit.id },
    create: {
      commitId: commit.id,
      finalThreshold: result.finalThreshold,
      finalWindow: result.finalWindow,
      activeTypes: result.activeTypes,
    },
    update: {
      finalThreshold: result.finalThreshold,
      finalWindow: result.finalWindow,
      activeTypes: result.activeTypes,
    },
  });

  return result;
}
