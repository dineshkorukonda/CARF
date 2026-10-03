import { describe, expect, it, vi } from "vitest";
import { activityErrorMessage, listIntegratedRepos, readOrEmpty } from "../../src/lib/repoActivity";

describe("readOrEmpty", () => {
  it("returns the query result when the read succeeds", async () => {
    const result = await readOrEmpty("ok", async () => [{ id: "c1" }], []);
    expect(result).toEqual({ value: [{ id: "c1" }], error: null });
  });

  it("returns the empty value and a schema message when a column is missing", async () => {
    const err = Object.assign(new Error("column trigger does not exist"), {
      code: "P2022",
      meta: { modelName: "RolloutOutcome", column: "trigger" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await readOrEmpty("rollouts", async () => {
      throw err;
    }, []);
    errorSpy.mockRestore();

    expect(result.value).toEqual([]);
    expect(result.error).toMatch(/Missing: RolloutOutcome trigger/);
    expect(activityErrorMessage(err)).toBe(result.error);
  });

  it("returns a generic message for other database failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await readOrEmpty("rollouts", async () => {
      throw new Error("connection refused");
    }, []);
    errorSpy.mockRestore();

    expect(result.value).toEqual([]);
    expect(result.error).toMatch(/could not be loaded/);
  });
});

describe("listIntegratedRepos", () => {
  const github = [
    {
      id: 1,
      name: "CARF",
      full_name: "dineshkorukonda/CARF",
      owner: "dineshkorukonda",
      default_branch: "main",
      private: false,
    },
    {
      id: 2,
      name: "Sahaay",
      full_name: "dineshkorukonda/Sahaay",
      owner: "dineshkorukonda",
      default_branch: "main",
      private: false,
    },
  ];

  it("returns only GitHub repos that have a RepoConnection row", () => {
    const listed = listIntegratedRepos(github, [
      { owner: "dineshkorukonda", repo: "Sahaay" },
    ]);
    expect(listed.map((r) => r.name)).toEqual(["Sahaay"]);
  });

  it("includes a connection even when GitHub did not return that repo", () => {
    const listed = listIntegratedRepos([], [{ owner: "dineshkorukonda", repo: "Sahaay" }]);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.full_name).toBe("dineshkorukonda/Sahaay");
  });

  it("does not invent a GitHub repository named production", () => {
    const listed = listIntegratedRepos([], [{ owner: "dineshkorukonda", repo: "production" }]);
    expect(listed).toEqual([]);
  });

  it("keeps a real GitHub repository that happens to be named production", () => {
    const listed = listIntegratedRepos(
      [
        {
          id: 9,
          name: "production",
          full_name: "dineshkorukonda/production",
          owner: "dineshkorukonda",
          default_branch: "main",
          private: false,
        },
      ],
      [{ owner: "dineshkorukonda", repo: "production" }]
    );
    expect(listed.map((r) => r.full_name)).toEqual(["dineshkorukonda/production"]);
  });
});
