/** Exact names win; a case-insensitive alias must identify a single process name. */
export function findPm2Process<T extends { name?: string }>(processes: T[], name: string): T | undefined {
  const exact = processes.find((process) => process.name === name);
  if (exact) return exact;
  const matches = processes.filter((process) => process.name?.toLowerCase() === name.toLowerCase());
  return new Set(matches.map((process) => process.name)).size === 1 ? matches[0] : undefined;
}
