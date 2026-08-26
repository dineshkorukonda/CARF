"use client";

import { useMemo, useState } from "react";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import {
  ClassificationSchema,
  ThresholdSchema,
  type ClassificationChangeType,
  type ThresholdChangeType,
} from "../../../../../lib/carfConfigSchema";
import { applyClassificationThresholdPatch } from "../../../../../lib/carfConfigWriter";

const CLASSIFICATION_TYPES: readonly ClassificationChangeType[] = ["infra", "dependency", "config", "code", "data"];
const THRESHOLD_TYPES: readonly ThresholdChangeType[] = ["infra", "dependency", "config", "code"];

interface RuleRow {
  type: ClassificationChangeType;
  patternsText: string;
}

interface ThresholdTypeFields {
  baseThreshold: string;
  baseWindow: string;
}

export interface RulesFormInitial {
  rules: RuleRow[];
  decay: string;
  complexityDecay: string;
  types: Record<ThresholdChangeType, ThresholdTypeFields>;
}

function splitPatterns(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function parseOptionalNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : NaN; // NaN signals "entered but not a number" to the caller
}

/** Builds the same patch shape carfConfigWriter.ts's applyClassificationThresholdPatch and
 *  the /api/config/save-rules route both consume, straight from form state. */
function buildPatch(state: RulesFormInitial) {
  const rules = state.rules
    .filter((r) => splitPatterns(r.patternsText).length > 0)
    .map((r) => ({ type: r.type, patterns: splitPatterns(r.patternsText) }));

  const types: Record<string, { baseThreshold?: number; baseWindow?: number }> = {};
  for (const t of THRESHOLD_TYPES) {
    const baseThreshold = parseOptionalNumber(state.types[t].baseThreshold);
    const baseWindow = parseOptionalNumber(state.types[t].baseWindow);
    const override: { baseThreshold?: number; baseWindow?: number } = {};
    if (baseThreshold !== undefined) override.baseThreshold = baseThreshold;
    if (baseWindow !== undefined) override.baseWindow = baseWindow;
    if (Object.keys(override).length > 0) types[t] = override;
  }

  const decay = parseOptionalNumber(state.decay);
  const complexityDecay = parseOptionalNumber(state.complexityDecay);

  return {
    classification: { rules },
    threshold: {
      ...(decay !== undefined ? { decay } : {}),
      ...(complexityDecay !== undefined ? { complexityDecay } : {}),
      ...(Object.keys(types).length > 0 ? { types } : {}),
    },
  };
}

export function RulesForm({
  installationId,
  owner,
  repo,
  initial,
}: {
  installationId: string;
  owner: string;
  repo: string;
  initial: RulesFormInitial;
}) {
  const [state, setState] = useState<RulesFormInitial>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const patch = useMemo(() => buildPatch(state), [state]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    const classificationResult = ClassificationSchema.safeParse(patch.classification);
    if (!classificationResult.success) {
      for (const issue of classificationResult.error.issues) errors.push(`classification: ${issue.message}`);
    }
    const thresholdResult = ThresholdSchema.safeParse(patch.threshold);
    if (!thresholdResult.success) {
      for (const issue of thresholdResult.error.issues) errors.push(`threshold: ${issue.message}`);
    }
    for (const t of THRESHOLD_TYPES) {
      if (Number.isNaN(parseOptionalNumber(state.types[t].baseThreshold))) errors.push(`threshold.types.${t}.baseThreshold isn't a number`);
      if (Number.isNaN(parseOptionalNumber(state.types[t].baseWindow))) errors.push(`threshold.types.${t}.baseWindow isn't a number`);
    }
    if (Number.isNaN(parseOptionalNumber(state.decay))) errors.push("threshold.decay isn't a number");
    if (Number.isNaN(parseOptionalNumber(state.complexityDecay))) errors.push("threshold.complexityDecay isn't a number");
    return errors;
  }, [patch, state]);

  const preview = useMemo(() => {
    if (validation.length > 0) return null;
    try {
      return applyClassificationThresholdPatch(null, patch);
    } catch (error) {
      return `# preview unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }, [patch, validation]);

  function updateRule(index: number, next: Partial<RuleRow>) {
    setState((s) => ({ ...s, rules: s.rules.map((r, i) => (i === index ? { ...r, ...next } : r)) }));
  }

  function removeRule(index: number) {
    setState((s) => ({ ...s, rules: s.rules.filter((_, i) => i !== index) }));
  }

  function addRule() {
    setState((s) => ({ ...s, rules: [...s.rules, { type: "infra", patternsText: "" }] }));
  }

  function updateTypeField(type: ThresholdChangeType, field: keyof ThresholdTypeFields, value: string) {
    setState((s) => ({ ...s, types: { ...s.types, [type]: { ...s.types[type], [field]: value } } }));
  }

  async function handleSave() {
    if (validation.length > 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/config/save-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId, owner, repo, ...patch }),
      });
      if (!response.ok) {
        setSubmitError("Couldn't save .carf.yml -- please try again.");
        return;
      }
      window.location.href = `/dashboard/config/${installationId}/rules?repo=${encodeURIComponent(`${owner}/${repo}`)}&saved=1`;
    } catch {
      setSubmitError("Couldn't save .carf.yml -- please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Classification rules</CardTitle>
          <CardDescription>Path-glob rules checked before the built-in Tier 1 rules (first match wins).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {state.rules.map((rule, index) => (
            <div key={index} className="flex gap-2 items-start rounded-lg border p-2">
              <select
                value={rule.type}
                onChange={(e) => updateRule(index, { type: e.target.value as ClassificationChangeType })}
                className="rounded-md border px-2 py-1.5 text-sm"
              >
                {CLASSIFICATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <textarea
                value={rule.patternsText}
                onChange={(e) => updateRule(index, { patternsText: e.target.value })}
                placeholder={"one glob per line, e.g.\ndeploy/**/*.yaml"}
                className="flex-1 rounded-md border px-2 py-1.5 text-sm font-mono"
                rows={2}
              />
              <Button variant="ghost" size="sm" type="button" onClick={() => removeRule(index)}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" type="button" onClick={addRule} className="self-start">
            Add rule
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Threshold / decay</CardTitle>
          <CardDescription>Overrides for DEFAULT_CONFIG -- leave a field blank to keep the built-in default.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-4">
            <label className="flex flex-col gap-1 text-sm">
              decay (0-1)
              <input
                value={state.decay}
                onChange={(e) => setState((s) => ({ ...s, decay: e.target.value }))}
                className="rounded-md border px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              complexityDecay (0-1)
              <input
                value={state.complexityDecay}
                onChange={(e) => setState((s) => ({ ...s, complexityDecay: e.target.value }))}
                className="rounded-md border px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          {THRESHOLD_TYPES.map((t) => (
            <div key={t} className="flex items-end gap-4 rounded-lg border p-2">
              <span className="text-sm font-medium w-24">{t}</span>
              <label className="flex flex-col gap-1 text-sm">
                baseThreshold
                <input
                  value={state.types[t].baseThreshold}
                  onChange={(e) => updateTypeField(t, "baseThreshold", e.target.value)}
                  className="rounded-md border px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                baseWindow (seconds)
                <input
                  value={state.types[t].baseWindow}
                  onChange={(e) => updateTypeField(t, "baseWindow", e.target.value)}
                  className="rounded-md border px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {validation.length > 0 && (
        <ul className="text-sm text-destructive list-disc pl-5">
          {validation.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>What will be merged into {owner}/{repo}&apos;s .carf.yml.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-3 text-xs overflow-auto">{preview}</pre>
          </CardContent>
        </Card>
      )}

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <Button onClick={handleSave} disabled={submitting || validation.length > 0} className="self-start">
        {submitting ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
