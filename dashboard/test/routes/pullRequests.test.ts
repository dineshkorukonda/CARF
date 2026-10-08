import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.fn();
const installation = vi.fn();
const list = vi.fn();
const commits = vi.fn();
vi.mock("../../src/lib/auth", () => ({ getCurrentAccount: () => account() }));
vi.mock("../../src/lib/projectAnalysis", () => ({ resolveProjectInstallation: (...args: unknown[]) => installation(...args) }));
vi.mock("../../src/lib/installationAccess", () => ({ mintInstallationToken: async () => "token" }));
vi.mock("../../src/adapters/github/pullRequestsClient", () => ({ listRepositoryPullRequests: (...args: unknown[]) => list(...args) }));
vi.mock("../../src/lib/prisma", () => ({ prisma: { commit: { findMany: (...args: unknown[]) => commits(...args) } } }));
const { GET } = await import("../../src/app/api/repo/pull-requests/route");
const request = () => new NextRequest("http://localhost/api/repo/pull-requests?owner=Acme&repo=App");
describe("GET /api/repo/pull-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks(); account.mockResolvedValue({ id: "account" }); installation.mockResolvedValue("123");
    list.mockResolvedValue({ pullRequests: [{ number: 1, headSha: "head" }], limited: false });
    commits.mockResolvedValue([{ sha: "head", threshold: { finalThreshold: 0.01, finalWindow: 180, activeTypes: ["code"] } }]);
  });
  it("joins current head policies using installation and repository scoping", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(installation).toHaveBeenCalledWith("account", "Acme", "App");
    expect(commits).toHaveBeenCalledWith(expect.objectContaining({ where: { installationId: "123", owner: { equals: "Acme", mode: "insensitive" }, repo: { equals: "App", mode: "insensitive" }, sha: { in: ["head"] } } }));
    expect((await response.json()).pullRequests[0].policy.finalThreshold).toBe(0.01);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("requires authentication", async () => {
    account.mockResolvedValue(null); expect((await GET(request())).status).toBe(401); expect(list).not.toHaveBeenCalled();
  });
  it("rejects projects outside the account's installations", async () => {
    installation.mockResolvedValue(null); expect((await GET(request())).status).toBe(403); expect(list).not.toHaveBeenCalled();
  });
  it("surfaces failed GitHub reads", async () => {
    list.mockRejectedValue(new Error("GitHub unavailable")); expect((await GET(request())).status).toBe(502);
  });
});
