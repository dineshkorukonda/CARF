import { describe, expect, it, vi } from "vitest";
import { handleWebhookCommit, type WebhookOrchestratorDeps } from "../src/webhookOrchestrator.js";
import type { DeployTarget } from "../src/adapters/github/webhookPayload.js";
import type { GitHubApiClient } from "../src/adapters/github/githubApiClient.js";
import type { InstallationTokenClient } from "../src/adapters/github/installationTokenClient.js";
import type { PipelinePrismaClient } from "../src/pipeline.js";
import type { RollbackAdapter } from "../src/adapters/rollbackAdapter.js";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function fakeGithubApiClient(): GitHubApiClient {
  return {
    compareCommits: vi.fn().mockResolvedValue({
      files: [{ filename: "src/foo.ts", status: "modified" }],
    }),
    getContent: vi.fn().mockResolvedValue("export const a = 1;\n"),
  };
}

function fakeInstallationTokenClient(): InstallationTokenClient {
  return { getInstallationToken: vi.fn().mockResolvedValue("token-abc") } as unknown as InstallationTokenClient;
}

class FakePrismaClient implements PipelinePrismaClient {
  commits = new Map<string, { id: string }>();

  commit = {
    upsert: vi.fn(async (args: { where: { owner_repo_sha: { owner: string; repo: string; sha: string } } }) => {
      const key = `${args.where.owner_repo_sha.owner}/${args.where.owner_repo_sha.repo}/${args.where.owner_repo_sha.sha}`;
      const existing = this.commits.get(key);
      if (existing) return existing;
      const row = { id: key };
      this.commits.set(key, row);
      return row;
    }),
  };
  changeVector = { upsert: vi.fn().mockResolvedValue(undefined) };
  threshold = { upsert: vi.fn().mockResolvedValue(undefined) };
}

const target: DeployTarget = {
  owner: "acme",
  repo: "widgets",
  baseSha: "base123",
  headSha: "head456",
  installationId: "inst-1",
};

function baseDeps(overrides: Partial<WebhookOrchestratorDeps> = {}): WebhookOrchestratorDeps {
  return {
    githubApiClient: fakeGithubApiClient(),
    installationTokenClient: fakeInstallationTokenClient(),
    carfConfig: undefined,
    logger: { info: vi.fn(), error: vi.fn() },
    prismaClient: new FakePrismaClient(),
    ...overrides,
  };
}

// setImmediate runs after all pending microtasks -- guarantees a fire-and-forget
// .then()/.catch()/.finally() chain has had a chance to run before we assert on it.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleWebhookCommit", () => {
  it("classifies and persists via processCommit even with no .carf.yml (carfConfig undefined)", async () => {
    const deps = baseDeps({ carfConfig: undefined });
    await handleWebhookCommit(target, deps);
    expect((deps.prismaClient as FakePrismaClient).commit.upsert).toHaveBeenCalledTimes(1);
  });

  it("Augment mode (explicit) persists and stops -- never calls the loop runner", async () => {
    const standaloneLoopRunner = vi.fn();
    const deps = baseDeps({ carfConfig: { mode: "augment" }, standaloneLoopRunner });
    await handleWebhookCommit(target, deps);
    expect(standaloneLoopRunner).not.toHaveBeenCalled();
  });

  it("no mode set (undefined carfConfig.mode) behaves like Augment -- stops after persisting", async () => {
    const standaloneLoopRunner = vi.fn();
    const deps = baseDeps({ carfConfig: {}, standaloneLoopRunner });
    await handleWebhookCommit(target, deps);
    expect(standaloneLoopRunner).not.toHaveBeenCalled();
  });

  it("Standalone + adapter.kind kubernetes kicks off the loop runner without awaiting it", async () => {
    const standaloneLoopRunner = vi.fn().mockResolvedValue({ rolledBack: false });
    const fakeAdapter: RollbackAdapter = { checkHealth: vi.fn(), rollback: vi.fn() };
    const rollbackAdapterFactory = vi.fn().mockReturnValue(fakeAdapter);
    const deps = baseDeps({
      carfConfig: { mode: "standalone", adapter: { kind: "kubernetes", target: "my-deployment" } },
      standaloneLoopRunner,
      rollbackAdapterFactory,
    });

    await handleWebhookCommit(target, deps);
    await flushMicrotasks();

    expect(rollbackAdapterFactory).toHaveBeenCalledWith("my-deployment");
    expect(standaloneLoopRunner).toHaveBeenCalledTimes(1);
    const call = standaloneLoopRunner.mock.calls[0]!;
    expect(call[0]).toBe("head456"); // sha
    expect(call[1]).toBe(fakeAdapter);
    expect(call[3]).toBe("my-deployment"); // target string
  });

  it("Standalone + missing adapter logs an error and does not call the loop runner (persistence already succeeded)", async () => {
    const standaloneLoopRunner = vi.fn();
    const deps = baseDeps({ carfConfig: { mode: "standalone" }, standaloneLoopRunner });

    await handleWebhookCommit(target, deps);

    expect(standaloneLoopRunner).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: undefined }),
      expect.stringContaining("unsupported")
    );
    expect((deps.prismaClient as FakePrismaClient).commit.upsert).toHaveBeenCalledTimes(1);
  });

  it("Standalone + adapter.kind dockerCompose logs an error and does not call the loop runner", async () => {
    const standaloneLoopRunner = vi.fn();
    const deps = baseDeps({
      carfConfig: { mode: "standalone", adapter: { kind: "dockerCompose", target: "web" } },
      standaloneLoopRunner,
    });

    await handleWebhookCommit(target, deps);

    expect(standaloneLoopRunner).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: { kind: "dockerCompose", target: "web" } }),
      expect.stringContaining("unsupported")
    );
  });

  it("skips a second loop kickoff for the same commit while the first is still running (idempotency guard)", async () => {
    let resolveLoop!: (value: { rolledBack: boolean }) => void;
    const loopPromise = new Promise<{ rolledBack: boolean }>((resolve) => {
      resolveLoop = resolve;
    });
    const standaloneLoopRunner = vi.fn().mockReturnValue(loopPromise);
    const deps = baseDeps({
      carfConfig: { mode: "standalone", adapter: { kind: "kubernetes", target: "my-deployment" } },
      standaloneLoopRunner,
    });

    await handleWebhookCommit(target, deps); // first delivery -- starts the loop
    await handleWebhookCommit(target, deps); // redelivery while the loop is still "running"

    expect(standaloneLoopRunner).toHaveBeenCalledTimes(1);

    resolveLoop({ rolledBack: false });
    await flushMicrotasks();

    // Guard cleared after completion -- a third delivery starts a fresh loop.
    await handleWebhookCommit(target, deps);
    expect(standaloneLoopRunner).toHaveBeenCalledTimes(2);
  });

  it("a rejected loop runner does not propagate out of handleWebhookCommit, and clears the guard afterward", async () => {
    const standaloneLoopRunner = vi
      .fn()
      .mockRejectedValueOnce(new Error("kubectl not found"))
      .mockResolvedValueOnce({ rolledBack: false });
    const deps = baseDeps({
      carfConfig: { mode: "standalone", adapter: { kind: "kubernetes", target: "my-deployment" } },
      standaloneLoopRunner,
    });

    await expect(handleWebhookCommit(target, deps)).resolves.toBeUndefined();
    await flushMicrotasks();

    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      expect.stringContaining("standalone rollback loop failed")
    );

    // Guard was cleared in .finally() -- a second delivery starts a fresh loop, not skipped.
    await handleWebhookCommit(target, deps);
    expect(standaloneLoopRunner).toHaveBeenCalledTimes(2);
  });

  it("a NoSignalError from processCommit is a clean no-op, not a thrown failure, and is logged", async () => {
    const githubApiClient: GitHubApiClient = {
      compareCommits: vi.fn().mockResolvedValue({ files: [{ filename: "README.md", status: "modified" }] }),
      getContent: vi.fn().mockResolvedValue("docs only, no recognized file type\n"),
    };
    const deps = baseDeps({ githubApiClient });

    await expect(handleWebhookCommit(target, deps)).resolves.toBeUndefined();
    expect(deps.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ sha: "head456" }),
      expect.stringContaining("no classification signal")
    );
  });

  it("any other error from processCommit propagates uncaught", async () => {
    const prismaClient: PipelinePrismaClient = {
      commit: { upsert: vi.fn().mockRejectedValue(new Error("db unavailable")) },
      changeVector: { upsert: vi.fn() },
      threshold: { upsert: vi.fn() },
    };
    const deps = baseDeps({ prismaClient });

    await expect(handleWebhookCommit(target, deps)).rejects.toThrow("db unavailable");
  });
});
