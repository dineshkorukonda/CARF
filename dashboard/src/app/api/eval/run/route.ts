import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { runSimulation } from "../../../../lib/evalHarness";

export async function POST() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const result = await runSimulation(50);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
