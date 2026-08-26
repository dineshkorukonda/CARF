import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../config/env";
import { getCurrentAccount } from "../../../../lib/auth";
import { updatePassword } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.redirect(new URL("/login", env.baseUrl()));
  }

  const form = await request.formData();
  const newPassword = String(form.get("newPassword") ?? "");

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.redirect(new URL("/dashboard/account?error=invalid_password", env.baseUrl()));
  }

  await updatePassword(prisma, account.id, newPassword);

  return NextResponse.redirect(new URL("/dashboard/account?saved=1", env.baseUrl()));
}
