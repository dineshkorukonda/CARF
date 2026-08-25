import { describe, expect, it, vi } from "vitest";
import { RealAppInfoClient } from "../../../src/adapters/github/appInfoClient.js";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes.js";

function fakeFetch(response: { ok: boolean; status: number; json?: unknown; text?: string }): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.json,
    text: async () => response.text ?? "",
  });
}

describe("RealAppInfoClient", () => {
  it("GETs the app installations endpoint with the App JWT as a Bearer token", async () => {
    const fetchFn = fakeFetch({ ok: true, status: 200, json: [] });
    const client = new RealAppInfoClient(fetchFn);

    await client.listInstallations("app-jwt-token");

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/app/installations",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer app-jwt-token",
          Accept: "application/vnd.github+json",
        }),
      })
    );
  });

  it("maps each installation's id and account login", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      status: 200,
      json: [
        { id: 111, account: { login: "dineshkorukonda" } },
        { id: 222, account: { login: "some-org" } },
      ],
    });
    const client = new RealAppInfoClient(fetchFn);

    const result = await client.listInstallations("app-jwt-token");

    expect(result).toEqual([
      { id: 111, account: "dineshkorukonda" },
      { id: 222, account: "some-org" },
    ]);
  });

  it("throws an HttpError-shaped object on a non-2xx response", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 401, text: "Bad credentials" });
    const client = new RealAppInfoClient(fetchFn);

    await expect(client.listInstallations("bad-jwt")).rejects.toMatchObject({
      status: 401,
      message: "Bad credentials",
    });
  });
});
