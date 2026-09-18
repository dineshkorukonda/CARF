import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "../../src/app/api/health/route";
import * as prismaModule from "../../src/lib/prisma";
import * as envModule from "../../src/config/env";
import * as coreApiClient from "../../src/adapters/coreApi/client";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 healthy when database and core-api are reachable", async () => {
    vi.spyOn(prismaModule.prisma, "$queryRaw").mockResolvedValue([{ "?column?": 1 }] as any);
    vi.spyOn(envModule.env, "coreApiBaseUrl").mockReturnValue("http://127.0.0.1:14101");
    vi.spyOn(coreApiClient, "fetchCoreApiVersion").mockResolvedValue({
      status: "ok",
      service: "carf-core-api",
      version: "0.1.0",
      uptime: 50,
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("healthy");
    expect(json.service).toBe("carf-dashboard");
    expect(json.database.status).toBe("connected");
    expect(json.coreApi.status).toBe("connected");
  });

  it("returns 503 degraded when core-api is unreachable", async () => {
    vi.spyOn(prismaModule.prisma, "$queryRaw").mockResolvedValue([{ "?column?": 1 }] as any);
    vi.spyOn(envModule.env, "coreApiBaseUrl").mockReturnValue("http://127.0.0.1:14101");
    vi.spyOn(coreApiClient, "fetchCoreApiVersion").mockRejectedValue(new Error("Connection refused"));

    const res = await GET();
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.database.status).toBe("connected");
    expect(json.coreApi.status).toBe("unreachable");
    expect(json.coreApi.error).toContain("Connection refused");
  });
});
