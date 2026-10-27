import type { StandaloneLoopLockPrismaClient } from "../../src/adapters/standaloneLoopLock.js";

export function leasePrisma() {
  const rows = new Map<string, { id: string | undefined; heartbeatAt: Date }>();
  const key = (scope: { owner: string; repo: string; sha: string }) => `${scope.owner}/${scope.repo}@${scope.sha}`;
  const client: StandaloneLoopLockPrismaClient = { standaloneLoopLock: {
    async create({ data }) {
      if (rows.has(key(data))) throw { code: "P2002" };
      rows.set(key(data), { id: data.id, heartbeatAt: new Date() });
      return {};
    },
    async updateMany({ where, data }) {
      const row = rows.get(key(where));
      if (!row || (where.id && row.id !== where.id)) return { count: 0 };
      row.heartbeatAt = data.heartbeatAt;
      return { count: 1 };
    },
    async deleteMany({ where }) {
      const row = rows.get(key(where));
      if (!row || (where.id && row.id !== where.id) ||
        (where.heartbeatAt && row.heartbeatAt >= where.heartbeatAt.lt)) return { count: 0 };
      rows.delete(key(where));
      return { count: 1 };
    },
  } };
  return { ...client, rows };
}
