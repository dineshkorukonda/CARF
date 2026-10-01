import { describe, expect, it, vi } from "vitest";
import { dispatchRollbackAlert } from "../../src/alerts/dispatch.js";

describe("dispatchRollbackAlert", () => {
  it("no-ops when webhook URL is unset", async () => {
    const fetchFn = vi.fn();
    await dispatchRollbackAlert(undefined, { commitSha: "abc", reason: "threshold breach" }, fetchFn);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("POSTs Slack-compatible JSON to the configured webhook", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await dispatchRollbackAlert(
      "https://hooks.example.com/carf",
      {
        owner: "acme",
        repo: "widgets",
        commitSha: "abc123",
        reason: "error rate 0.12 >= 0.05",
        finalErrorRate: 0.12,
        rollbackVerified: true,
      },
      fetchFn
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://hooks.example.com/carf");
    expect(init.method).toBe("POST");
    const payload = JSON.parse(init.body);
    expect(payload.text).toContain("acme/widgets");
    expect(payload.text).toContain("abc123");
    expect(payload.rollbackVerified).toBe(true);
  });
});
