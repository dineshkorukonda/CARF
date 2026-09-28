import type { ThresholdConfig } from "./engine.js";

export const DEFAULT_ENGINE_CONFIG: ThresholdConfig = {
  baseThreshold: {
    infra: 0.01,
    dependency: 0.03,
    config: 0.05,
    code: 0.08,
    data: 0.01,
  },
  baseWindow: {
    infra: 60,
    dependency: 180,
    config: 300,
    code: 900,
    data: 600,
  },
  decay: 0.5,
  complexityDecay: 0.3,
};

export interface VersionedEngineConfig extends ThresholdConfig {
  version: string;
}

/**
 * Engine configuration v1.
 * Retains exact default tuning from original CARF engine:
 * - infra: threshold 0.01, window 60s
 * - dependency: threshold 0.03, window 180s
 * - config: threshold 0.05, window 300s
 * - code: threshold 0.08, window 900s
 * - data: threshold 0.01, window 600s
 * - decay: 0.5
 * - complexityDecay: 0.3
 */
export const ENGINE_CONFIG_V1: VersionedEngineConfig = {
  version: "v1",
  ...DEFAULT_ENGINE_CONFIG,
};

export const CURRENT_ENGINE_CONFIG: VersionedEngineConfig = ENGINE_CONFIG_V1;
