import { describe, expect, it } from "vitest";
import { findPm2Process } from "../../src/adapters/pm2Process.js";
import { PM2Adapter } from "../../src/adapters/pm2.js";

describe("PM2 process identity", () => {
  it("prefers the exact match even when names differ only in case", () => {
    expect(findPm2Process([{ name: "Web" }, { name: "web" }], "Web")?.name).toBe("Web");
    expect(findPm2Process([{ name: "Web" }, { name: "web" }], "WEB")).toBeUndefined();
  });
  it("allows cluster instances sharing the same canonical name", () => {
    expect(findPm2Process([{ name: "Web" }, { name: "Web" }], "web")?.name).toBe("Web");
  });
  it("reloads the actual mixed-case name after PM2 rejects an alias", async () => {
    const commands: string[] = [];
    const adapter = new PM2Adapter("old", { layout: "git", cwd: "/opt/app", exec: async (command) => {
      commands.push(command);
      if (command === "cd /opt/app && pm2 reload WEB") throw new Error("Process or Namespace WEB not found");
      return { stdout: command === "pm2 jlist" ? JSON.stringify([{ name: "Web" }]) : "", stderr: "" };
    } });
    await adapter.rollback("WEB");
    expect(commands).toEqual(["cd /opt/app && git checkout old", "cd /opt/app && pm2 reload WEB", "pm2 jlist", "cd /opt/app && pm2 reload Web"]);
  });
  it("does not retry command failures unrelated to process lookup", async () => {
    const commands: string[] = [];
    const adapter = new PM2Adapter("", { exec: async (command) => { commands.push(command); throw new Error("permission denied"); } });
    await expect(adapter.reload("Web")).rejects.toThrow("permission denied");
    expect(commands).toEqual(["pm2 reload Web"]);
  });
});
