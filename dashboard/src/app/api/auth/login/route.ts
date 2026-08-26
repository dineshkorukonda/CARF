import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../config/env";
import { verifyCredentials } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_TTL_MS } from "../../../../lib/session";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const account = await verifyCredentials(prisma, email, password);
  if (!account) {
    return NextResponse.redirect(new URL("/login?error=invalid_credentials", env.baseUrl()));
  }

  const response = NextResponse.redirect(new URL("/dashboard", env.baseUrl()));
  response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(env.sessionSecret(), account.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  return response;
}
