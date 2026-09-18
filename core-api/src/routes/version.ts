import type { FastifyInstance, FastifySchema } from "fastify";

export interface VersionInfo {
  status: "ok";
  service: "carf-core-api";
  version: string;
  uptime: number;
  nodeVersion: string;
  timestamp: string;
}

const responseSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      required: ["status", "service", "version", "uptime", "nodeVersion", "timestamp"],
      properties: {
        status: { type: "string" },
        service: { type: "string" },
        version: { type: "string" },
        uptime: { type: "number" },
        nodeVersion: { type: "string" },
        timestamp: { type: "string" },
      },
      additionalProperties: false,
    },
  },
};

export function registerVersionRoute(app: FastifyInstance) {
  app.get("/v1/version", { schema: responseSchema }, async (): Promise<VersionInfo> => {
    return {
      status: "ok",
      service: "carf-core-api",
      version: "0.1.0",
      uptime: process.uptime(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };
  });
}
