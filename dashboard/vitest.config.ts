import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors tsconfig.json's "@/*" -> "./src/*". Next.js resolves this itself, so it
      // only mattered once test/smoke/routes.test.ts started importing page and layout
      // modules, which reach shadcn/ui components that import "@/lib/utils".
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
