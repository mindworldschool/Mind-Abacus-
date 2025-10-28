/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTime } from '../../../js/utils/timer.js';

describe('Timer Utilities', () => {
  describe('formatTime()', () => {
    it('should format zero milliseconds', () => {
      expect(formatTime(0)).toBe('00:00');
    });

    it('should format seconds', () => {
      expect(formatTime(5000)).toBe('00:05');
      expect(formatTime(30000)).toBe('00:30');
      expect(formatTime(59000)).toBe('00:59');
    });

    it('should format minutes', () => {
      expect(formatTime(60000)).toBe('01:00');
      expect(formatTime(120000)).toBe('02:00');
      expect(formatTime(600000)).toBe('10:00');
    });

    it('should format minutes and seconds', () => {
      expect(formatTime(90000)).toBe('01:30');
      expect(formatTime(125000)).toBe('02:05');
      expect(formatTime(195000)).toBe('03:15');
    });

    it('should pad with zeros', () => {
      expect(formatTime(1000)).toBe('00:01');
      expect(formatTime(61000)).toBe('01:01');
      expect(formatTime(3661000)).toBe('61:01'); // 61 minutes
    });

    it('should handle large values', () => {
      expect(formatTime(3600000)).toBe('60:00'); // 60 minutes
      expect(formatTime(5999000)).toBe('99:59');
    });

    it('should handle invalid input', () => {
      expect(formatTime(null)).toBe('00:00');
      expect(formatTime(undefined)).toBe('00:00');
      expect(formatTime(NaN)).toBe('00:00');
      expect(formatTime(-1000)).toBe('00:00');
      expect(formatTime(Infinity)).toBe('00:00');
    });

    it('should round down fractional seconds', () => {
      expect(formatTime(1500)).toBe('00:01');
      expect(formatTime(59999)).toBe('00:59');
    });

    it('should handle string input that can be converted', () => {
      expect(formatTime('5000')).toBe('00:00'); // strings are not valid
    });
  });

  describe('Edge cases', () => {
    it('should handle very small positive values', () => {
      expect(formatTime(1)).toBe('00:00');
      expect(formatTime(999)).toBe('00:00');
    });

    it('should handle exactly one second', () => {
      expect(formatTime(1000)).toBe('00:01');
    });

    it('should handle exactly one minute', () => {
      expect(formatTime(60000)).toBe('01:00');
    });
  });
});
