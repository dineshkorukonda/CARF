// Confirms the Augment mode integration examples documented in the root README (see
// "Augment Mode Integration") are at least syntactically valid YAML. Doesn't validate
// against the Argo Rollouts / Flagger CRD schemas — just that they parse.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.resolve(__dirname, "../../../examples");

const exampleFiles = ["argo-rollouts-analysistemplate.yaml", "flagger-webhook-metric.yaml"];

describe("Augment mode example YAML files", () => {
  it.each(exampleFiles)("%s parses as valid YAML with at least one document", (fileName) => {
    const filePath = path.join(examplesDir, fileName);
    const contents = readFileSync(filePath, "utf8");

    const documents = yaml.loadAll(contents);

    expect(documents.length).toBeGreaterThan(0);
    for (const doc of documents) {
      expect(doc).toBeTypeOf("object");
      expect(doc).not.toBeNull();
    }
  });
});
