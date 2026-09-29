import { describe, expect, it } from "vitest";
import { pickInstallationIdForCommit } from "../../src/lib/commitPageAccess";

describe("pickInstallationIdForCommit", () => {
  it("uses the commit's installation when the account owns it", () => {
    expect(
      pickInstallationIdForCommit({
        commitInstallationId: "42",
        ownedInstallationIds: ["41", "42"],
        connectionInstallationId: "99",
      }),
    ).toBe("42");
  });

  it("refuses a commit whose installation is not linked to the account", () => {
    expect(
      pickInstallationIdForCommit({
        commitInstallationId: "42",
        ownedInstallationIds: ["41"],
        connectionInstallationId: "42",
      }),
    ).toBeNull();
  });

  it("falls back to the repo connection when the commit has no installationId", () => {
    expect(
      pickInstallationIdForCommit({
        commitInstallationId: null,
        ownedInstallationIds: ["7"],
        connectionInstallationId: "7",
      }),
    ).toBe("7");
  });
});
