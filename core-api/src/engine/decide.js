const thresholds = require('./thresholds');

/**
 * Pure decision engine function.
 * Evaluates error rate reading and elapsed seconds against thresholds for a given change type.
 *
 * @param {'code'|'config'|'dependency'|'infra'} changeType
 * @param {number} errorRateReading - Current error rate percentage (e.g. 5 for 5%)
 * @param {number} elapsedSeconds - Seconds elapsed since deployment began observing
 * @returns {'stable' | 'rollback_triggered' | 'observing'}
 */
function decide(changeType, errorRateReading, elapsedSeconds) {
  const config = thresholds[changeType] || thresholds.code;

  if (typeof errorRateReading === 'number' && errorRateReading >= config.error_rate_threshold) {
    return 'rollback_triggered';
  }

  if (typeof elapsedSeconds === 'number' && elapsedSeconds >= config.window_seconds) {
    return 'stable';
  }

  return 'observing';
}

module.exports = decide;
