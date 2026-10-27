import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { expect, it } from "vitest";
import { CarfConfigSchema } from "../../src/config/carfConfigSchema.js";

it.each(["github-actions-pm2", "docker-compose", "generic-ci-http", "argo-rollouts", "flagger", "kubernetes", "systemd", "prometheus"])(
  "documents a schema-valid configuration for %s", name => {
    const source = readFileSync(resolve(__dirname, `../../../docs/integrations/${name}.md`), "utf8");
    const yaml = source.match(/```yaml\r?\n([\s\S]*?)```/)?.[1];
    expect(yaml).toBeTruthy();
    expect(CarfConfigSchema.safeParse(load(yaml!)).success).toBe(true);
  });
