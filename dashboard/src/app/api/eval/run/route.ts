import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { runSimulation } from "../../../../lib/evalHarness";

export async function POST(req: Request) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    let count = 50;
    try {
      const body = (await req.json()) as { count?: number };
      if (typeof body?.count === "number" && body.count >= 10 && body.count <= 200) {
        count = body.count;
      }
    } catch {
      // Default to 50
    }

    const result = await runSimulation(count);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Simulation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
