import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { env } from "../../../../config/env";

export async function POST(req: Request) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      commitSha: string;
      action: "rollback" | "promote";
    };

    if (!body?.commitSha || !body?.action) {
      return NextResponse.json({ error: "commitSha and action are required" }, { status: 400 });
    }

    const { commitSha, action } = body;
    const errorRate = action === "rollback" ? 1.0 : 0.0;
    const durationMs = action === "rollback" ? 1000 : 999_999;

    // Call core-api POST /v1/report to record intervention and trigger adapter if rollback
    const coreApiRes = await fetch(`${env.coreApiBaseUrl()}/v1/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commit: commitSha,
        errorRate,
        durationMs,
      }),
    });

    if (!coreApiRes.ok) {
      // If core-api returned an error, capture it
      const errBody = await coreApiRes.text();
      console.warn("[rollout/intervention] core-api report response:", coreApiRes.status, errBody);
    }

    return NextResponse.json({
      success: true,
      commitSha,
      action,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Intervention failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
