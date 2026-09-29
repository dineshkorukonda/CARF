import { describe, expect, it, vi } from "vitest";
import { activityErrorMessage, readOrEmpty } from "../../src/lib/repoActivity";

describe("readOrEmpty", () => {
  it("returns the query result when the read succeeds", async () => {
    const result = await readOrEmpty("ok", async () => [{ id: "c1" }], []);
    expect(result).toEqual({ value: [{ id: "c1" }], error: null });
  });

  it("returns the empty value and a schema message when a column is missing", async () => {
    const err = Object.assign(new Error("column trigger does not exist"), { code: "P2022" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await readOrEmpty("rollouts", async () => {
      throw err;
    }, []);
    errorSpy.mockRestore();

    expect(result.value).toEqual([]);
    expect(result.error).toMatch(/db:migrate:deploy/);
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
