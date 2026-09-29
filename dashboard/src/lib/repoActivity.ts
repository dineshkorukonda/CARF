/**
 * Rollout/commit reads on the repositories screens. A schema mismatch (missing
 * table or column) used to throw out of the server component and replace the
 * whole page with a generic server error, which hides the GitHub repo list
 * during standalone testing. These reads fail soft instead.
 */

export function activityErrorMessage(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
  const meta =
    err && typeof err === "object" && "meta" in err && (err as { meta: unknown }).meta && typeof (err as { meta: unknown }).meta === "object"
      ? (err as { meta: Record<string, unknown> }).meta
      : null;
  const detail = meta
    ? [meta.modelName, meta.table, meta.column, meta.field_name].filter((v) => typeof v === "string").join(" ")
    : "";
  if (code === "P2021" || code === "P2022") {
    const suffix = detail ? ` Missing: ${detail}.` : "";
    return `Rollout history is unavailable because the database is missing a table or column the app expects.${suffix} In Neon SQL, run core-api/prisma/repair-rollout-schema.sql then reload.`;
  }
  return "Rollout history could not be loaded. Repositories from the GitHub App are still listed.";
}

export async function readOrEmpty<T>(
  label: string,
  read: () => Promise<T>,
  empty: T,
): Promise<{ value: T; error: string | null }> {
  try {
    return { value: await read(), error: null };
  } catch (err) {
    console.error(label, err);
    return { value: empty, error: activityErrorMessage(err) };
  }
}
