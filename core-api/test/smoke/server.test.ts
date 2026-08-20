import type { FastifyInstance } from "fastify";
import { describe, expect, it, afterEach } from "vitest";
import { buildApp } from "../../src/app.js";

describe("server smoke test", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("boots and responds 200 {status: ok} on GET /healthz", async () => {
    app = buildApp();
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
