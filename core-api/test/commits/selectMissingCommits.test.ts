import { describe, expect, it } from "vitest";
import { selectMissingCommits } from "../../src/commits/selectMissingCommits.js";

describe("selectMissingCommits", () => {
  it("returns unclassified commits oldest first and skips ones already stored", () => {
    const branch = [
      { sha: "tip", parentSha: "mid" },
      { sha: "mid", parentSha: "old" },
      { sha: "old", parentSha: "base" },
    ];

    expect(selectMissingCommits(branch, new Set(["tip"]))).toEqual([
      { sha: "old", parentSha: "base" },
      { sha: "mid", parentSha: "old" },
    ]);
  });

  it("skips a root commit that has no parent to diff against", () => {
    expect(selectMissingCommits([{ sha: "root", parentSha: null }], new Set())).toEqual([]);
  });
});
