import { NextRequest } from "next/server";
import { signIn } from "../../../../auth";

/** GET /api/auth/github — start GitHub OAuth without an inline Server Action. */
export async function GET(request: NextRequest) {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/dashboard";
  await signIn("github", { redirectTo: callbackUrl });
}
