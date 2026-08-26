import { NextResponse } from "next/server";
import { env } from "../../../../config/env";
import { SESSION_COOKIE_NAME } from "../../../../lib/session";

export async function POST() {
  const response = NextResponse.redirect(new URL("/login", env.baseUrl()));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
