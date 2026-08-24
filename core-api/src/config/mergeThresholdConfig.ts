import { DEFAULT_CONFIG, type ThresholdConfig } from "../threshold/engine.js";
import type { CarfConfig } from "./carfConfigSchema.js";

/**
 * Merges a `.carf.yml` `threshold` block (already schema-validated by
 * carfConfig.ts's loader) over `base` (defaults to DEFAULT_CONFIG),
 * per-field: `decay`/`complexityDecay` override if present, and each
 * `types.<type>.{baseThreshold,baseWindow}` overrides only the fields the
 * user actually specified — an omitted field, or an omitted type
 * entirely, keeps `base`'s value.
 */
export function mergeThresholdConfig(
  userThreshold: CarfConfig["threshold"] | undefined,
  base: ThresholdConfig = DEFAULT_CONFIG
): ThresholdConfig {
  if (!userThreshold) {
    return base;
  }

  const types = userThreshold.types ?? {};

  return {
    decay: userThreshold.decay ?? base.decay,
    complexityDecay: userThreshold.complexityDecay ?? base.complexityDecay,
    baseThreshold: {
      infra: types.infra?.baseThreshold ?? base.baseThreshold.infra,
      dependency: types.dependency?.baseThreshold ?? base.baseThreshold.dependency,
      config: types.config?.baseThreshold ?? base.baseThreshold.config,
      code: types.code?.baseThreshold ?? base.baseThreshold.code,
    },
    baseWindow: {
      infra: types.infra?.baseWindow ?? base.baseWindow.infra,
      dependency: types.dependency?.baseWindow ?? base.baseWindow.dependency,
      config: types.config?.baseWindow ?? base.baseWindow.config,
      code: types.code?.baseWindow ?? base.baseWindow.code,
    },
  };
}
