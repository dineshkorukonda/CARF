import { cookies } from "next/headers";
import { env } from "../config/env";
import { prisma } from "./prisma";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "./session";
import type { AccountRow } from "./accountService";

/** Reads and verifies the session cookie for the current request; null if not logged in. */
export async function getCurrentAccount(): Promise<AccountRow | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionCookieValue(env.sessionSecret(), raw);
  if (!session) return null;

  return prisma.account.findUnique({ where: { id: session.accountId } });
}
