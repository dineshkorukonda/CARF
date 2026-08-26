import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../config/env";
import { createAccount, EmailAlreadyRegisteredError } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_TTL_MS } from "../../../../lib/session";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.redirect(new URL("/signup?error=invalid_input", env.baseUrl()));
  }

  let account;
  try {
    account = await createAccount(prisma, email, password);
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      return NextResponse.redirect(new URL("/signup?error=email_taken", env.baseUrl()));
    }
    throw err;
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
