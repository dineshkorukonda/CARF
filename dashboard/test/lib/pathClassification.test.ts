import { describe, expect, it } from "vitest";
import { classifyPath } from "../../src/lib/pathClassification";

describe("classifyPath", () => {
  it("labels tests, infra, lockfiles, and source", () => {
    expect(classifyPath("src/app.test.ts")).toBe("test");
    expect(classifyPath("Dockerfile")).toBe("infra");
    expect(classifyPath("package-lock.json")).toBe("dependency");
    expect(classifyPath("prisma/migrations/001.sql")).toBe("data");
    expect(classifyPath(".carf.yml")).toBe("config");
    expect(classifyPath("src/lib/foo.ts")).toBe("code");
    expect(classifyPath("README.md")).toBe("unclassified");
  });
});
