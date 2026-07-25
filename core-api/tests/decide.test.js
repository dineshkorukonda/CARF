const decide = require('../src/engine/decide');
const thresholds = require('../src/engine/thresholds');

describe('decide.js Unit Tests', () => {
  describe('Stays stable under threshold', () => {
    test('returns observing when under threshold and within window', () => {
      expect(decide('code', 2.0, 100)).toBe('observing');
    });

    test('returns stable when under threshold and after window elapsed', () => {
      expect(decide('code', 2.0, 600)).toBe('stable');
      expect(decide('code', 4.9, 601)).toBe('stable');
    });
  });

  describe('Triggers rollback when over threshold', () => {
    test('returns rollback_triggered when error rate reaches or breaches threshold within window', () => {
      expect(decide('code', 5.0, 100)).toBe('rollback_triggered');
      expect(decide('code', 15.0, 50)).toBe('rollback_triggered');
    });

    test('returns rollback_triggered even after window if error rate is breached', () => {
      expect(decide('code', 5.0, 700)).toBe('rollback_triggered');
    });
  });

  describe('Respects different thresholds per change type', () => {
    test('code change: 5% error rate, 600s window', () => {
      expect(thresholds.code).toEqual({ error_rate_threshold: 5, window_seconds: 600 });
      // Under threshold within window
      expect(decide('code', 4.9, 599)).toBe('observing');
      // Under threshold after window
      expect(decide('code', 4.9, 600)).toBe('stable');
      // At or above threshold
      expect(decide('code', 5.0, 10)).toBe('rollback_triggered');
    });

    test('config change: 3% error rate, 300s window', () => {
      expect(thresholds.config).toEqual({ error_rate_threshold: 3, window_seconds: 300 });
      // Under threshold within window
      expect(decide('config', 2.9, 299)).toBe('observing');
      // Under threshold after window
      expect(decide('config', 2.9, 300)).toBe('stable');
      // At or above threshold (e.g. 3% triggers rollback for config, whereas code would be observing)
      expect(decide('config', 3.0, 10)).toBe('rollback_triggered');
      expect(decide('code', 3.0, 10)).toBe('observing');
    });

    test('dependency change: 2% error rate, 300s window', () => {
      expect(thresholds.dependency).toEqual({ error_rate_threshold: 2, window_seconds: 300 });
      // Under threshold within window
      expect(decide('dependency', 1.9, 299)).toBe('observing');
      // Under threshold after window
      expect(decide('dependency', 1.9, 300)).toBe('stable');
      // At or above threshold
      expect(decide('dependency', 2.0, 10)).toBe('rollback_triggered');
    });

    test('infra change: 1% error rate, 120s window', () => {
      expect(thresholds.infra).toEqual({ error_rate_threshold: 1, window_seconds: 120 });
      // Under threshold within window
      expect(decide('infra', 0.9, 119)).toBe('observing');
      // Under threshold after window
      expect(decide('infra', 0.9, 120)).toBe('stable');
      // At or above threshold (e.g. 1% triggers rollback for infra)
      expect(decide('infra', 1.0, 5)).toBe('rollback_triggered');
    });
  });

  describe('Fallback behavior', () => {
    test('defaults to code threshold for unknown change types', () => {
      expect(decide('unknown_type', 4.0, 100)).toBe('observing');
      expect(decide('unknown_type', 5.0, 100)).toBe('rollback_triggered');
    });
  });
});
