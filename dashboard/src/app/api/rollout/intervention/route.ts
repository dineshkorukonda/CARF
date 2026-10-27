import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";

// This legacy endpoint only fabricated health readings; it never executed a
// rollback or promotion. Require the authenticated rollout-specific action.
export async function POST() {
  if (!await getCurrentAccount()) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ error: "Use the rollout-specific rollback endpoint. Manual promotion is not implemented." }, { status: 410 });
}
