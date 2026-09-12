import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { runSimulation } from "../../../../lib/evalHarness";

export async function POST(req: Request) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const result = await runSimulation(50);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Simulation failed" }, { status: 500 });
  }
}
