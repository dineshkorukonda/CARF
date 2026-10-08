import { describe, expect, it, vi, beforeEach } from "vitest";
const config = vi.fn();
const installations = vi.fn();
const connection = vi.fn();
vi.mock("../../src/adapters/github/contentsClient", () => ({ getCarfConfigFile: (...args: unknown[]) => config(...args) }));
vi.mock("../../src/lib/installationAccess", () => ({ mintInstallationToken: async () => "token" }));
vi.mock("../../src/lib/accountService", () => ({ listInstallationsForAccount: (...args: unknown[]) => installations(...args) }));
vi.mock("../../src/lib/repoConnectionService", () => ({ findRepoConnectionSafe: (...args: unknown[]) => connection(...args) }));
vi.mock("../../src/lib/prisma", () => ({ prisma: {} }));
const { readProjectAnalysisTrigger, resolveProjectInstallation } = await import("../../src/lib/projectAnalysis");
describe("project analysis settings", () => {
  beforeEach(() => { vi.clearAllMocks(); config.mockResolvedValue(null); installations.mockResolvedValue([{ installationId: "123" }]); connection.mockResolvedValue({ installationId: "123" }); });
  it("resolves projects only within the account's installations", async () => {
    expect(await resolveProjectInstallation("user", "acme", "app")).toBe("123");
    expect(connection).toHaveBeenCalledWith(["123"], "acme", "app");
    connection.mockResolvedValue(null);
    expect(await resolveProjectInstallation("user", "other", "app")).toBeNull();
  });
  it.each(["commits", "pull_requests", "both"])("reads %s from authoritative YAML", async (analysisTrigger) => {
    config.mockResolvedValue({ content: `analysisTrigger: ${analysisTrigger}\n` });
    expect(await readProjectAnalysisTrigger("123", "acme", "app")).toBe(analysisTrigger);
  });
  it("defaults legacy projects to both", async () => {
    expect(await readProjectAnalysisTrigger("123", "acme", "app")).toBe("both");
    config.mockResolvedValue({ content: "mode: augment\n" });
    expect(await readProjectAnalysisTrigger("123", "acme", "app")).toBe("both");
  });
  it("surfaces read failures and invalid choices", async () => {
    config.mockRejectedValue(new Error("offline"));
    await expect(readProjectAnalysisTrigger("123", "acme", "app")).rejects.toThrow("offline");
    config.mockResolvedValue({ content: "analysisTrigger: invalid\n" });
    await expect(readProjectAnalysisTrigger("123", "acme", "app")).rejects.toThrow();
  });
});
