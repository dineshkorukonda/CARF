import { auth } from "../auth";
import { prisma } from "./prisma";
import type { AccountRow } from "./accountService";

/** Reads and verifies the session for the current request; null if not logged in. */
export async function getCurrentAccount(): Promise<AccountRow | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: true },
  });
  if (!user) return null;

  const githubAccount = user.accounts.find((a) => a.provider === "github");

  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name ?? null,
    image: user.image ?? null,
    githubId: githubAccount?.providerAccountId ?? ((session.user as { githubId?: string }).githubId ?? null),
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt,
  };
}
