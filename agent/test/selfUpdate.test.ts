import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

process.env.CARF_INSTALL_TOKEN = process.env.CARF_INSTALL_TOKEN || "test-token";

const { applyStagedAgentUpdate, compareAgentVersion } = await import("../agent.mjs");

describe("compareAgentVersion", () => {
  it("orders semver-ish versions", () => {
    expect(compareAgentVersion("0.1.0", "0.1.0")).toBe(0);
    expect(compareAgentVersion("0.1.1", "0.1.0")).toBeGreaterThan(0);
    expect(compareAgentVersion("0.1.0", "0.2.0")).toBeLessThan(0);
  });
});

describe("applyStagedAgentUpdate", () => {
  it("rejects a staged file that fails the syntax check and keeps the current file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "carf-agent-"));
    const currentPath = join(dir, "agent.mjs");
    writeFileSync(currentPath, "export const ok = true;\n");

    await expect(
      applyStagedAgentUpdate("this is not javascript {", {
        currentPath,
        check: async () => {
          throw new Error("SyntaxError");
        },
      })
    ).rejects.toThrow(/syntax check/);

    expect(readFileSync(currentPath, "utf-8")).toBe("export const ok = true;\n");
  });

  it("swaps only after a successful check and keeps a backup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "carf-agent-"));
    const currentPath = join(dir, "agent.mjs");
    writeFileSync(currentPath, "export const ok = true;\n");

    await applyStagedAgentUpdate("export const ok = false;\n", {
      currentPath,
      check: async () => undefined,
    });

    expect(readFileSync(currentPath, "utf-8")).toBe("export const ok = false;\n");
    expect(readFileSync(`${currentPath}.bak`, "utf-8")).toBe("export const ok = true;\n");
  });
});
