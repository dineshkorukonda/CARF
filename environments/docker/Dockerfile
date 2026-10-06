FROM node:20-alpine

ARG VERSION=v1
WORKDIR /app

COPY app/${VERSION}/server.mjs ./server.mjs

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

HEALTHCHECK --interval=5s --timeout=3s --start-period=2s --retries=3 \
  CMD node -e 'require("http").get("http://localhost:8080/health", (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on("error", () => process.exit(1))'

CMD ["node", "server.mjs"]
