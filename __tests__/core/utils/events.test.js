/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus, EVENTS } from '../../../core/utils/events.js';

describe('EventBus', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    eventBus.clear();
  });

  describe('on() and emit()', () => {
    it('should subscribe and receive events', () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);

      eventBus.emit('test-event', { data: 'test' });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should handle multiple subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);

      eventBus.emit('test-event', 'data');

      expect(handler1).toHaveBeenCalledWith('data');
      expect(handler2).toHaveBeenCalledWith('data');
    });

    it('should emit events without data', () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);

      eventBus.emit('test-event');

      expect(handler).toHaveBeenCalledWith(null);
    });
  });

  describe('off()', () => {
    it('should unsubscribe from events', () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);
      eventBus.off('test-event', handler);

      eventBus.emit('test-event', 'data');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should only unsubscribe the specific handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);
      eventBus.off('test-event', handler1);

      eventBus.emit('test-event', 'data');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith('data');
    });
  });

  describe('once()', () => {
    it('should trigger only once', () => {
      const handler = vi.fn();
      eventBus.once('test-event', handler);

      eventBus.emit('test-event', 'data1');
      eventBus.emit('test-event', 'data2');

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('data1');
    });

    it('should return unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.once('test-event', handler);

      unsubscribe();
      eventBus.emit('test-event', 'data');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('should clear all listeners for specific event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);

      eventBus.clear('event1');

      eventBus.emit('event1', 'data');
      eventBus.emit('event2', 'data');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should clear all listeners when no event specified', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);

      eventBus.clear();

      eventBus.emit('event1', 'data');
      eventBus.emit('event2', 'data');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount()', () => {
    it('should return correct listener count', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      expect(eventBus.listenerCount('test-event')).toBe(0);

      eventBus.on('test-event', handler1);
      expect(eventBus.listenerCount('test-event')).toBe(1);

      eventBus.on('test-event', handler2);
      expect(eventBus.listenerCount('test-event')).toBe(2);

      eventBus.off('test-event', handler1);
      expect(eventBus.listenerCount('test-event')).toBe(1);
    });
  });

  describe('Unsubscribe function from on()', () => {
    it('should unsubscribe when calling returned function', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('test-event', handler);

      eventBus.emit('test-event', 'data1');
      unsubscribe();
      eventBus.emit('test-event', 'data2');

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith('data1');
    });
  });

  describe('EVENTS constants', () => {
    it('should have predefined event names', () => {
      expect(EVENTS.LANGUAGE_CHANGE).toBeDefined();
      expect(EVENTS.ROUTE_CHANGE).toBeDefined();
      expect(EVENTS.SETTINGS_UPDATE).toBeDefined();
      expect(EVENTS.TRAINING_FINISH).toBeDefined();
      expect(EVENTS.STATE_CHANGE).toBeDefined();
    });
  });
});
