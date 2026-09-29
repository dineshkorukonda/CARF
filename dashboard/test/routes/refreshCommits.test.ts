import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentAccount = vi.fn();
const getInstallationForAccount = vi.fn();
const ensureCoreApiKey = vi.fn();
const refreshRepoCommits = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: { coreApiBaseUrl: () => "http://core-api.test" },
}));

vi.mock("../../src/lib/auth", () => ({
  getCurrentAccount: () => getCurrentAccount(),
}));

vi.mock("../../src/lib/prisma", () => ({ prisma: {} }));

vi.mock("../../src/lib/accountService", () => ({
  getInstallationForAccount: (...args: unknown[]) => getInstallationForAccount(...args),
}));

vi.mock("../../src/lib/coreApiAccess", () => ({
  ensureCoreApiKey: (...args: unknown[]) => ensureCoreApiKey(...args),
}));

vi.mock("../../src/adapters/coreApi/client", () => ({
  refreshRepoCommits: (...args: unknown[]) => refreshRepoCommits(...args),
}));

const { POST } = await import("../../src/app/api/repo/refresh-commits/route");

const ACCOUNT = { id: "account-1" };
const INSTALLATION = { id: "row-1", installationId: "55555", coreApiKey: "carf_key" };

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/repo/refresh-commits", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  for (const mock of [getCurrentAccount, getInstallationForAccount, ensureCoreApiKey, refreshRepoCommits]) {
    mock.mockReset();
  }
});

describe("POST /api/repo/refresh-commits", () => {
  it("returns 401 when signed out", async () => {
    getCurrentAccount.mockResolvedValue(null);
    const response = await POST(request({ installationId: "55555", owner: "acme", repo: "widgets" }));
    expect(response.status).toBe(401);
  });

  it("asks core-api to classify commits missing since the stored tip", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    ensureCoreApiKey.mockResolvedValue("carf_key");
    refreshRepoCommits.mockResolvedValue({
      pulled: [{ sha: "mid", baseSha: "old" }],
      alreadyKnown: 1,
      failed: [],
    });

    const response = await POST(
      request({ installationId: "55555", owner: "acme", repo: "widgets", branch: "main" }),
    );

    expect(response.status).toBe(200);
    expect(refreshRepoCommits).toHaveBeenCalledWith("http://core-api.test", "carf_key", {
      owner: "acme",
      repo: "widgets",
      branch: "main",
    });
    await expect(response.json()).resolves.toEqual({
      pulled: [{ sha: "mid", baseSha: "old" }],
      alreadyKnown: 1,
      failed: [],
    });
  });
});
