/**
 * Rollout/commit reads on the repositories screens. A schema mismatch (missing
 * table or column) used to throw out of the server component and replace the
 * whole page with a generic server error, which hides the GitHub repo list
 * during standalone testing. These reads fail soft instead.
 */

export function activityErrorMessage(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "P2021" || code === "P2022") {
    return "Rollout history is unavailable because the database schema is behind the app. On the server, from core-api, run npm run db:migrate:deploy and reload.";
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
