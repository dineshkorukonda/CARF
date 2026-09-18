import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // Delete user (Prisma cascade onDelete deletes associated Account, Session, Installation rows)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      ok: true,
      message: "Account deleted successfully",
    });
  } catch (err) {
    console.error("Failed to delete account:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete account" },
      { status: 500 }
    );
  }
}
