/**
 * Sensitivity thresholds per change type.
 *
 * Thresholds:
 * - code: 5% error rate, 600s window
 * - config: 3% error rate, 300s window
 * - dependency: 2% error rate, 300s window
 * - infra: 1% error rate, 120s window
 */
module.exports = {
  code: {
    error_rate_threshold: 5,
    window_seconds: 600,
  },
  config: {
    error_rate_threshold: 3,
    window_seconds: 300,
  },
  dependency: {
    error_rate_threshold: 2,
    window_seconds: 300,
  },
  infra: {
    error_rate_threshold: 1,
    window_seconds: 120,
  },
};
