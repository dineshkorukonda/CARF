import { NextResponse } from "next/server";
import { AGENT_RELEASE_VERSION } from "../../../../lib/agentVersion";

/**
 * Public published agent version. Used by installed agents for self-update (#157).
 * Does not expose install tokens or database credentials.
 */
export async function GET() {
  return NextResponse.json({
    version: AGENT_RELEASE_VERSION,
    artifact: "/agent/agent.mjs",
  });
}
