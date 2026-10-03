import { describe, expect, it } from "vitest";
import { resolveRepoMode } from "../src/deploymentMode.js";

describe("core-api resolveRepoMode", () => {
  it("uses the explicit column over storedConfig", () => {
    expect(
      resolveRepoMode({
        mode: "augment",
        storedConfig: { mode: "standalone", target: "sahaay" },
      })
    ).toBe("augment");
  });

  it("preserves Sahaay PM2 storedConfig as standalone", () => {
    expect(
      resolveRepoMode({
        storedConfig: { target: "sahaay", layout: "git", cwd: "/opt/sahaay/my-app" },
      })
    ).toBe("standalone");
  });
});
