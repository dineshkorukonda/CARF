import { describe, expect, it, vi } from "vitest";
import { load } from "js-yaml";
import {
  CARF_SECRET_NAME,
  CARF_WORKFLOW_MARKER,
  CARF_WORKFLOW_PATH,
  checkWorkflowContent,
  inspectExistingWorkflow,
  renderCarfWorkflow,
} from "../../src/lib/githubActionsWorkflow";
import {
  GitHubActionsIntegrationService,
  IntegrationError,
  createPrismaIntegrationStore,
  type IntegrationRecord,
  type IntegrationContext,
  type IntegrationStore,
  type ServiceDeps,
} from "../../src/lib/githubActionsIntegrationService";
import { GitHubApiError } from "../../src/adapters/github/repoContentsClient";

const CORE = "https://carf.example.com";
const SECRET_VALUE = "carf_super_secret_key";
const TOKEN_VALUE = "ghs_installation_token";

describe("renderCarfWorkflow", () => {
  const yaml = renderCarfWorkflow({ coreApiUrl: `${CORE}/`, branch: "main" });

  it("is CARF-managed and calls the augment endpoint with owner/repo/sha", () => {
    expect(yaml.startsWith(CARF_WORKFLOW_MARKER)).toBe(true);
    expect(yaml).toContain("/v1/augment/threshold");
    expect(yaml).toContain("owner=$CARF_OWNER");
    expect(yaml).toContain("repo=$CARF_REPO");
    expect(yaml).toContain("sha=$CARF_SHA");
    expect(yaml).toContain("github.sha");
    expect(yaml).toContain(`secrets.${CARF_SECRET_NAME}`);
    expect(yaml).toContain(`CARF_API_URL: ${CORE}\n`);
  });

  it("exposes threshold, window and change vector as outputs and env", () => {
    for (const k of ["threshold", "window", "change_vector"]) expect(yaml).toContain(`${k}: \${{ steps.carf.outputs.${k} }}`);
    expect(yaml).toContain("CARF_THRESHOLD");
    expect(yaml).toContain("CARF_WINDOW");
    expect(yaml).toContain("CARF_CHANGE_VECTOR");
  });

  it("never performs standalone behavior", () => {
    expect(yaml.toLowerCase()).not.toMatch(/pm2|host.?agent|rollback|rollout|standalone/);
  });

  it("gates PM2 deployment on a successful CI run and reports the terminal rollout", () => {
    const managed = renderCarfWorkflow({ coreApiUrl: CORE, branch: "main", managedPm2: true });
    const parsed = load(managed) as { on: { workflow_run: { workflows: string[] } }; jobs: { "carf-deploy": { if: string } } };
    expect(parsed.on.workflow_run.workflows).toEqual(["CI"]);
    expect(parsed.jobs["carf-deploy"].if).toContain("conclusion == 'success'");
    expect(managed).toContain("github.event.workflow_run.head_sha");
    expect(managed).toContain("expectedSha:$sha,ciRunId:$ciRunId,observeLive:true");
    expect(managed).toContain("/v1/rollouts/status");
    expect(managed).toContain("ROLLED_BACK|FAILED");
    expect(managed).not.toContain("github.sha");
    expect(inspectExistingWorkflow(managed)).toEqual({ kind: "managed", version: 3 });
  });

  it("rejects values that could break out of the YAML", () => {
    expect(() => renderCarfWorkflow({ coreApiUrl: CORE, branch: "main\n  evil: 1" })).toThrow();
    expect(() => renderCarfWorkflow({ coreApiUrl: "https://x.com\nevil", branch: "main" })).toThrow();
  });

  it("classifies existing files", () => {
    expect(inspectExistingWorkflow(null).kind).toBe("absent");
    expect(inspectExistingWorkflow(yaml)).toEqual({ kind: "managed", version: 1 });
    expect(inspectExistingWorkflow("name: my own workflow\non: push\n").kind).toBe("foreign");
  });

  it("passes its own static checks", () => {
    const checks = checkWorkflowContent(yaml, CORE);
    expect(checks.hasMarker && checks.usesAugmentEndpoint && checks.referencesSecret && checks.referencesCarfApi).toBe(true);
    expect(checks.triggersDeployment).toBe(false);
  });
});

function fakeStore(): IntegrationStore & { rows: Map<string, IntegrationRecord> } {
  const rows = new Map<string, IntegrationRecord>();
  const k = (key: { installationId: string; owner: string; repo: string }) => `${key.installationId}/${key.owner}/${key.repo}`;
  return {
    rows,
    find: async (key) => rows.get(k(key)) ?? null,
    upsert: async (key, data) => {
      const prev: IntegrationRecord = rows.get(k(key)) ?? {
        status: "not_configured",
        branch: null,
        workflowPath: null,
        workflowVersion: null,
        configuredAt: null,
        lastVerifiedAt: null,
        lastSyncAt: null,
        lastPolicyAt: null,
        lastCommitSha: null,
        lastError: null,
      };
      const next = { ...prev, ...data };
      rows.set(k(key), next);
      return next;
    },
  };
}

function setup(overrides: { file?: string | null; permissions?: Record<string, string>; probe?: number[] } = {}) {
  const store = fakeStore();
  let file: { sha: string; content: string } | null =
    overrides.file === undefined || overrides.file === null ? null : { sha: "filesha", content: overrides.file };
  let secretSet = false;
  const probes = [...(overrides.probe ?? [200])];
  const github = {
    getInstallationPermissions: vi.fn(async () => overrides.permissions ?? { contents: "write", workflows: "write", secrets: "write", actions: "read" }),
    hasDeploymentCi: vi.fn(async () => true),
    getRepository: vi.fn(async () => ({ defaultBranch: "main", fullName: "o/r" })),
    getFile: vi.fn(async () => file),
    putFile: vi.fn(async (_t: string, _o: string, _r: string, args: { content: string }) => {
      file = { sha: "newsha", content: args.content };
    }),
    deleteFile: vi.fn(async () => {
      file = null;
    }),
    setActionsSecret: vi.fn(async () => {
      secretSet = true;
    }),
    actionsSecretExists: vi.fn(async () => secretSet),
    deleteActionsSecret: vi.fn(async () => {
      secretSet = false;
    }),
    getHeadSha: vi.fn(async () => "headsha1234567"),
  };
  const refreshCommits = vi.fn(async () => undefined);
  const logError = vi.fn();
  const deps: ServiceDeps = {
    store,
    github: github as unknown as ServiceDeps["github"],
    mintInstallationToken: async () => TOKEN_VALUE,
    signAppJwt: () => "app.jwt",
    getApiKey: async () => SECRET_VALUE,
    coreApiUrl: CORE,
    probePolicy: vi.fn(async () => {
      const status = probes.length > 1 ? probes.shift()! : probes[0]!;
      return status === 200
        ? { status, body: { threshold: 0.07, window: 120, changeVector: { code: 0.4 } } }
        : { status };
    }),
    refreshCommits,
    now: () => new Date("2026-10-03T07:00:00Z"),
    logError,
  };
  const ctx: IntegrationContext = {
    installationId: "42",
    owner: "o",
    repo: "r",
    connection: { mode: "augment", storedConfig: { integration: "github-actions" } },
  };
  return { service: new GitHubActionsIntegrationService(deps), github, store, ctx, refreshCommits, logError, getFile: () => file };
}

describe("GitHubActionsIntegrationService", () => {
  it("installs deployment and verifies CI for standalone PM2", async () => {
    const t = setup();
    t.ctx.connection = { mode: "standalone", storedConfig: { mode: "standalone", deploymentIntegration: "github_actions", runtimeAdapter: "pm2", target: "app", layout: "git", buildCommand: "npm ci && npm run build" } };
    const result = await t.service.install(t.ctx);
    expect(result.status).toBe("ready");
    expect(result.workflowVersion).toBe(3);
    expect(t.getFile()?.content).toContain("name: CARF PM2 Deployment");
    expect(result.checks?.find((check) => check.id === "ci-gate")?.ok).toBe(true);
  });
  it("refuses to install PM2 deployment without Actions read permission", async () => {
    const t = setup({ permissions: { contents: "write", workflows: "write", secrets: "write" } });
    t.ctx.connection = { mode: "standalone", storedConfig: { mode: "standalone", runtimeAdapter: "pm2", target: "app" } };
    await expect(t.service.install(t.ctx)).rejects.toThrow("Actions: Read");
    expect(t.github.putFile).not.toHaveBeenCalled();
  });
  it("requires a build command for git deployment before writing a workflow", async () => {
    const t = setup();
    t.ctx.connection = { mode: "standalone", storedConfig: { mode: "standalone", runtimeAdapter: "pm2", target: "app", layout: "git" } };
    await expect(t.service.install(t.ctx)).rejects.toThrow("build command");
    expect(t.github.putFile).not.toHaveBeenCalled();
  });
  it("installs end-to-end and ends Ready without leaking secrets", async () => {
    const t = setup();
    const result = await t.service.install(t.ctx);
    expect(result.status).toBe("ready");
    expect(result.workflowPath).toBe(CARF_WORKFLOW_PATH);
    expect(result.policy?.threshold).toBe(0.07);
    expect(t.github.putFile).toHaveBeenCalledTimes(1);
    expect(t.github.setActionsSecret).toHaveBeenCalledWith(TOKEN_VALUE, "o", "r", CARF_SECRET_NAME, SECRET_VALUE);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET_VALUE);
    expect(serialized).not.toContain(TOKEN_VALUE);
  });

  it("is idempotent: a second install does not rewrite an up-to-date workflow", async () => {
    const t = setup();
    await t.service.install(t.ctx);
    const second = await t.service.install(t.ctx);
    expect(second.status).toBe("ready");
    expect(t.github.putFile).toHaveBeenCalledTimes(1);
  });

  it("updates an outdated CARF-managed workflow in place using its sha", async () => {
    const t = setup({ file: `${CARF_WORKFLOW_MARKER}\n# version: 0\nname: old\n` });
    await t.service.install(t.ctx);
    expect(t.github.putFile).toHaveBeenCalledWith(TOKEN_VALUE, "o", "r", expect.objectContaining({ sha: "filesha" }));
  });

  it("refuses to overwrite a workflow CARF does not manage", async () => {
    const t = setup({ file: "name: my pipeline\non: push\n" });
    await expect(t.service.install(t.ctx)).rejects.toMatchObject({ code: "workflow_not_managed" });
    expect(t.github.putFile).not.toHaveBeenCalled();
    expect(t.getFile()?.content).toBe("name: my pipeline\non: push\n");
    expect([...t.store.rows.values()][0]!.status).toBe("failed");
  });

  it("reports missing GitHub App permissions with an actionable message", async () => {
    const t = setup({ permissions: { contents: "write" } });
    const err = await t.service.install(t.ctx).then(() => { throw new Error("expected rejection"); }, (e: unknown) => e as IntegrationError);
    expect(err).toBeInstanceOf(IntegrationError);
    expect(err.code).toBe("insufficient_permission");
    expect(err.message).toMatch(/Workflows/);
    expect(err.message).toMatch(/Secrets/);
  });

  it("maps GitHub failures to safe messages and logs detail server-side", async () => {
    const t = setup();
    t.github.putFile.mockRejectedValueOnce(new GitHubApiError("branch_protected", 409, "Branch protection prevents CARF", "raw stack"));
    await expect(t.service.install(t.ctx)).rejects.toMatchObject({ code: "branch_protected" });
    expect(t.logError).toHaveBeenCalledWith(expect.any(String), "raw stack");
  });

  it("surfaces secret configuration failures without leaking detail", async () => {
    const t = setup();
    t.github.setActionsSecret.mockRejectedValueOnce(new GitHubApiError("github_unavailable", 500, "x", "boom"));
    const err = await t.service.install(t.ctx).then(() => { throw new Error("expected rejection"); }, (e: unknown) => e as IntegrationError);
    expect(err.code).toBe("secret_failed");
    expect(err.message).not.toContain("boom");
  });

  it("allows standalone repositories configured with GitHub Actions deployment integration", async () => {
    const t = setup();
    const result = await t.service.install({
      ...t.ctx,
      connection: { mode: "standalone", deploymentIntegration: "github_actions" },
    });
    expect(result.status).toBe("ready");
    expect(result.workflowPath).toBe(CARF_WORKFLOW_PATH);
    expect(result.checks?.find((c) => c.id === "deployment-integration")?.ok).toBe(true);
  });

  it("refuses repositories with other deployment integrations", async () => {
    const t = setup();
    await expect(
      t.service.install({ ...t.ctx, connection: { mode: "augment", storedConfig: { integration: "flagger" } } })
    ).rejects.toMatchObject({ code: "wrong_integration" });
    await expect(
      t.service.install({ ...t.ctx, connection: { deploymentIntegration: "argo_rollouts" } })
    ).rejects.toMatchObject({ code: "wrong_integration" });
    expect(t.github.getRepository).not.toHaveBeenCalled();
  });

  it("verify triggers a commit refresh once when HEAD is unclassified, then succeeds", async () => {
    const t = setup({ probe: [404, 200] });
    const result = await t.service.install(t.ctx);
    expect(t.refreshCommits).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("ready");
  });

  it("marks needs_attention when CARF cannot analyze HEAD", async () => {
    const t = setup({ probe: [404] });
    const result = await t.service.install(t.ctx);
    expect(result.status).toBe("needs_attention");
    expect(result.policy).toBeNull();
    expect(result.lastError).toMatch(/current commit/);
  });

  it("disable removes only the managed workflow and clears state", async () => {
    const t = setup();
    await t.service.install(t.ctx);
    const result = await t.service.disable(t.ctx);
    expect(result.status).toBe("not_configured");
    expect(t.github.deleteFile).toHaveBeenCalledTimes(1);
    expect(t.github.deleteActionsSecret).toHaveBeenCalledTimes(1);
  });

  it("disable leaves a foreign workflow alone", async () => {
    const t = setup({ file: "name: mine\n" });
    await t.service.disable(t.ctx);
    expect(t.github.deleteFile).not.toHaveBeenCalled();
  });

  it("manualWorkflow falls back cleanly to main branch when store.find throws", async () => {
    const t = setup();
    t.store.find = vi.fn().mockRejectedValue(new Error("DB error"));
    const yaml = await t.service.manualWorkflow(t.ctx);
    expect(yaml).toContain("CARF Augment Policy");
    expect(yaml).toContain("main");
  });
});

describe("createPrismaIntegrationStore", () => {
  const key = { installationId: "inst_123", owner: "dineshkorukonda", repo: "Sahaay" };

  it("returns null on find when repoIntegration client is missing", async () => {
    const store = createPrismaIntegrationStore({});
    const res = await store.find(key);
    expect(res).toBeNull();
  });

  it("calls onSchemaError and retries on find when findUnique throws", async () => {
    let callCount = 0;
    const onSchemaError = vi.fn().mockImplementation(async () => {});
    const mockPrisma = {
      repoIntegration: {
        findUnique: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            const err = new Error("The table public.RepoIntegration does not exist in the current database");
            (err as unknown as { code: string }).code = "P2021";
            throw err;
          }
          return { status: "ready", branch: "main" };
        }),
        upsert: vi.fn(),
      },
    };

    const store = createPrismaIntegrationStore(mockPrisma as any, onSchemaError);
    const res = await store.find(key);
    expect(onSchemaError).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ status: "ready", branch: "main" });
  });

  it("falls back to null on find if retry still throws", async () => {
    const onSchemaError = vi.fn().mockImplementation(async () => {
      throw new Error("DDL repair failed");
    });
    const mockPrisma = {
      repoIntegration: {
        findUnique: vi.fn().mockRejectedValue(new Error("P2021")),
        upsert: vi.fn(),
      },
    };

    const store = createPrismaIntegrationStore(mockPrisma as any, onSchemaError);
    const res = await store.find(key);
    expect(onSchemaError).toHaveBeenCalledTimes(1);
    expect(res).toBeNull();
  });

  it("calls onSchemaError and retries upsert when table is missing", async () => {
    let callCount = 0;
    const onSchemaError = vi.fn().mockImplementation(async () => {});
    const mockPrisma = {
      repoIntegration: {
        findUnique: vi.fn(),
        upsert: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error("P2021 table missing");
          }
          return { status: "configuring", branch: "main" };
        }),
      },
    };

    const store = createPrismaIntegrationStore(mockPrisma as any, onSchemaError);
    const res = await store.upsert(key, { status: "configuring" });
    expect(onSchemaError).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ status: "configuring", branch: "main" });
  });
});
