import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ account: vi.fn(), installation: vi.fn(), find: vi.fn(), update: vi.fn(), fetch: vi.fn() }));
vi.mock("../../src/lib/auth", () => ({ getCurrentAccount: mocks.account }));
vi.mock("../../src/lib/accountService", () => ({ getInstallationForAccount: mocks.installation, listInstallationsForAccount: async () => [] }));
vi.mock("../../src/lib/prisma", () => ({ prisma: { repoConnection: { findFirst: mocks.find, update: mocks.update }, $queryRawUnsafe: async () => [] } }));
vi.mock("../../src/lib/coreApiAccess", () => ({ ensureCoreApiKey: async () => "api-key" }));
vi.mock("../../src/config/env", () => ({ env: { coreApiBaseUrl: () => "http://core" } }));
vi.mock("../../src/lib/repoConnectionService", () => ({ attemptAutoRepairSchema: async () => undefined, mapRawRepoConnection: (row: unknown) => row }));

import { GET } from "../../src/app/api/pm2/status/route";
import { POST } from "../../src/app/api/repo/set-process/route";

const request = () => new NextRequest("http://localhost/api/repo/set-process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ installationId: "inst-1", owner: "acme", repo: "Widgets", processName: "web" }) });

describe("PM2 repository connection routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.account.mockResolvedValue({ id: "account-1" });
    mocks.installation.mockResolvedValue({ installationId: "inst-1" });
    mocks.find.mockResolvedValue({ id: "conn-1", pm2Process: "WEB", storedConfig: { target: "WEB", cwd: "/opt/web", layout: "git" }, verifiedAt: new Date() });
    mocks.update.mockResolvedValue({ pm2Process: "web" });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ connected: true, processes: [{ name: "Web", status: "online" }] })));
    vi.stubGlobal("fetch", mocks.fetch);
  });
  it("rejects process changes without authentication", async () => {
    mocks.account.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects another account's installation before looking up a connection", async () => {
    mocks.installation.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("scopes the process change to the installation and requires re-verification", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith({ where: { installationId: "inst-1", owner: { equals: "acme", mode: "insensitive" }, repo: { equals: "Widgets", mode: "insensitive" } } });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "conn-1" }, data: { pm2Process: "web", storedConfig: { target: "web", name: "web", cwd: "/opt/web", layout: "git" }, verifiedAt: null } });
  });
  it("shows the canonical process name and uses the correct installation", async () => {
    const response = await GET(new NextRequest("http://localhost/api/pm2/status?installationId=inst-1&owner=acme&repo=Widgets"));
    expect(await response.json()).toMatchObject({ connected: true, processFound: true, processName: "Web" });
    expect(mocks.find.mock.calls[0][0].where.installationId).toBe("inst-1");
  });
  it("does not display another installation's process association", async () => {
    mocks.installation.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://localhost/api/pm2/status?installationId=other&owner=acme&repo=Widgets"));
    expect(await response.json()).toMatchObject({ connected: false, processFound: false });
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
