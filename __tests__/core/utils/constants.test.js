import { describe, it, expect } from 'vitest';
import {
  UI,
  TIMER,
  FONT_SIZE,
  AUDIO,
  STORAGE_KEYS,
  DEFAULTS,
  EVENTS
} from '../../../core/utils/constants.js';

describe('Constants', () => {
  describe('UI constants', () => {
    it('should have all UI timing constants', () => {
      expect(UI.BIG_DIGIT_SCALE).toBe(1.15);
      expect(UI.PAUSE_AFTER_CHAIN_MS).toBe(600);
      expect(UI.DELAY_BETWEEN_STEPS_MS).toBe(40);
      expect(UI.TRANSITION_DELAY_MS).toBe(500);
      expect(UI.TIMEOUT_DELAY_MS).toBe(800);
    });

    it('should have positive values', () => {
      Object.values(UI).forEach(value => {
        expect(value).toBeGreaterThan(0);
      });
    });
  });

  describe('TIMER constants', () => {
    it('should have timer configuration', () => {
      expect(TIMER.MS_THRESHOLD).toBe(10000);
      expect(TIMER.UPDATE_INTERVAL_MS).toBe(100);
      expect(TIMER.MIN_PLAYBACK_RATE).toBe(0.5);
      expect(TIMER.MAX_PLAYBACK_RATE).toBe(2.0);
    });

    it('should have valid playback rate range', () => {
      expect(TIMER.MIN_PLAYBACK_RATE).toBeLessThan(TIMER.MAX_PLAYBACK_RATE);
      expect(TIMER.MIN_PLAYBACK_RATE).toBeGreaterThan(0);
    });
  });

  describe('FONT_SIZE constants', () => {
    it('should have font size configuration', () => {
      expect(FONT_SIZE.BASE_SIZE).toBe(120);
      expect(FONT_SIZE.MIN_SIZE).toBe(35);
      expect(FONT_SIZE.ACTION_PENALTY).toBe(1.8);
      expect(FONT_SIZE.DIGIT_PENALTY).toBe(3);
    });

    it('should have min size less than base size', () => {
      expect(FONT_SIZE.MIN_SIZE).toBeLessThan(FONT_SIZE.BASE_SIZE);
    });
  });

  describe('AUDIO constants', () => {
    it('should have audio configuration', () => {
      expect(AUDIO.DEFAULT_VOLUME).toBe(1);
      expect(AUDIO.MIN_VOLUME).toBe(0);
      expect(AUDIO.MAX_VOLUME).toBe(1);
    });

    it('should have valid volume range', () => {
      expect(AUDIO.MIN_VOLUME).toBeLessThanOrEqual(AUDIO.DEFAULT_VOLUME);
      expect(AUDIO.DEFAULT_VOLUME).toBeLessThanOrEqual(AUDIO.MAX_VOLUME);
    });
  });

  describe('STORAGE_KEYS constants', () => {
    it('should have all storage keys', () => {
      expect(STORAGE_KEYS.SETTINGS).toBe('abacus-settings');
      expect(STORAGE_KEYS.LANGUAGE).toBe('abacus-language');
      expect(STORAGE_KEYS.RESULTS_HISTORY).toBe('abacus-results-history');
    });

    it('should have unique keys', () => {
      const keys = Object.values(STORAGE_KEYS);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('should have prefixed keys', () => {
      Object.values(STORAGE_KEYS).forEach(key => {
        expect(key).toMatch(/^abacus-/);
      });
    });
  });

  describe('DEFAULTS constants', () => {
    it('should have default values', () => {
      expect(DEFAULTS.LANGUAGE).toBe('ua');
      expect(DEFAULTS.ROUTE).toBe('settings');
      expect(DEFAULTS.EXAMPLES_COUNT).toBe(10);
      expect(DEFAULTS.ACTIONS_MIN).toBe(2);
      expect(DEFAULTS.ACTIONS_MAX).toBe(4);
    });

    it('should have valid action range', () => {
      expect(DEFAULTS.ACTIONS_MIN).toBeLessThan(DEFAULTS.ACTIONS_MAX);
      expect(DEFAULTS.ACTIONS_MIN).toBeGreaterThan(0);
    });
  });

  describe('EVENTS constants', () => {
    it('should have all event names', () => {
      expect(EVENTS.LANGUAGE_CHANGE).toBe('language:change');
      expect(EVENTS.ROUTE_CHANGE).toBe('route:change');
      expect(EVENTS.SETTINGS_UPDATE).toBe('settings:update');
      expect(EVENTS.TRAINING_FINISH).toBe('training:finish');
      expect(EVENTS.STATE_CHANGE).toBe('state:change');
    });

    it('should have colon-separated format', () => {
      Object.values(EVENTS).forEach(event => {
        expect(event).toMatch(/^[\w-]+:[\w-]+$/);
      });
    });

    it('should have unique event names', () => {
      const events = Object.values(EVENTS);
      const uniqueEvents = new Set(events);
      expect(uniqueEvents.size).toBe(events.length);
    });
  });
});
