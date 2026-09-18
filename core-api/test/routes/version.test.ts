import type { FastifyInstance } from "fastify";
import { describe, expect, it, afterEach } from "vitest";
import { buildApp } from "../../src/app.js";

describe("GET /v1/version", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("returns 200 with service name, version, and uptime", async () => {
    app = buildApp();
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/v1/version" });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe("ok");
    expect(json.service).toBe("carf-core-api");
    expect(json.version).toBe("0.1.0");
    expect(typeof json.uptime).toBe("number");
    expect(typeof json.nodeVersion).toBe("string");
    expect(typeof json.timestamp).toBe("string");
  });
});
