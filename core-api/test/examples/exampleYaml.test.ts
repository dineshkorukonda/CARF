// Confirms the Augment mode integration examples documented in the root README (see
// "Augment Mode Integration"), plus the CARF Threshold Check Action's example workflow
// (issue #55), are at least syntactically valid YAML. Doesn't validate against the Argo
// Rollouts / Flagger CRD schemas or the GitHub Actions workflow schema — just that they parse.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.resolve(__dirname, "../../../examples");
const actionsDir = path.resolve(__dirname, "../../../.github/actions");

const exampleFiles = [
  { dir: examplesDir, name: "argo-rollouts-analysistemplate.yaml" },
  { dir: examplesDir, name: "flagger-webhook-metric.yaml" },
  { dir: examplesDir, name: "carf-threshold-action-workflow.yml" },
  { dir: actionsDir, name: "carf-threshold/action.yml" },
];

describe("Augment mode / CI integration example YAML files", () => {
  it.each(exampleFiles)("$name parses as valid YAML with at least one document", ({ dir, name }) => {
    const filePath = path.join(dir, name);
    const contents = readFileSync(filePath, "utf8");

    const documents = yaml.loadAll(contents);

    expect(documents.length).toBeGreaterThan(0);
    for (const doc of documents) {
      expect(doc).toBeTypeOf("object");
      expect(doc).not.toBeNull();
    }
  });
});
