import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { env } from "../../../config/env";
import { fetchCoreApiVersion } from "../../../adapters/coreApi/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbStatus = "connected";
  let dbError: string | null = null;
  try {
    // Quick probe to check DB connectivity
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = "disconnected";
    dbError = err instanceof Error ? err.message : String(err);
  }

  let coreApiStatus = "unknown";
  let coreApiDetails: unknown = null;
  let coreApiError: string | null = null;
  let coreApiLatencyMs = 0;

  try {
    const coreApiBaseUrl = env.coreApiBaseUrl();
    const t0 = Date.now();
    const versionInfo = await fetchCoreApiVersion(coreApiBaseUrl);
    coreApiLatencyMs = Date.now() - t0;
    coreApiStatus = "connected";
    coreApiDetails = versionInfo;
  } catch (err) {
    coreApiStatus = "unreachable";
    coreApiError = err instanceof Error ? err.message : String(err);
  }

  const isHealthy = dbStatus === "connected" && coreApiStatus === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      service: "carf-dashboard",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - start,
      database: {
        status: dbStatus,
        ...(dbError ? { error: dbError } : {}),
      },
      coreApi: {
        status: coreApiStatus,
        latencyMs: coreApiLatencyMs,
        ...(coreApiDetails ? { details: coreApiDetails } : {}),
        ...(coreApiError ? { error: coreApiError } : {}),
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
