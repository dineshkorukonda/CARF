import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getEvaluationHistory } from "../../../../lib/evalHarness";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const history = await getEvaluationHistory(10);
    return NextResponse.json({ history });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
