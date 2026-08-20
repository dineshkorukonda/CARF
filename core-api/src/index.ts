import Fastify from "fastify";
import { env } from "./config/env.js";

const app = Fastify({ logger: true });

app.get("/healthz", async () => ({ status: "ok" }));

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
