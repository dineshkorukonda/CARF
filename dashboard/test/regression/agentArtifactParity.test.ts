import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("published agent artifact", () => {
  it("keeps dashboard/public/agent/agent.mjs identical to agent/agent.mjs", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../../../agent/agent.mjs"), "utf-8");
    const published = fs.readFileSync(path.resolve(__dirname, "../../public/agent/agent.mjs"), "utf-8");
    expect(published).toBe(source);
  });
});
