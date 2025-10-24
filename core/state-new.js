/**
 * Improved state management with:
 * - Immutable state
 * - Event-based subscriptions
 * - LocalStorage persistence
 * - Type safety through JSDoc
 */

import { eventBus } from './utils/events.js';
import { storage } from './utils/storage.js';
import { EVENTS, DEFAULTS } from './utils/constants.js';
import { logger } from './utils/logger.js';

const CONTEXT = 'State';

/**
 * @typedef {Object} AppState
 * @property {string} route
 * @property {string} language
 * @property {Object} settings
 * @property {Object} results
 */

// Default state
const defaultState = {
  route: DEFAULTS.ROUTE,
  language: DEFAULTS.LANGUAGE,
  settings: {
    mode: "mental",
    digits: "1",
    combineLevels: false,
    actions: { count: 1, infinite: false },
    examples: { count: 2, infinite: false },
    timeLimit: "none",
    speed: "none",
    toggles: {
      hard: false,
      dictation: false,
      fractions: false,
      mirror: false,
      round: false,
      positive: false,
      negative: false,
      opposite: false
    },
    blocks: {
      simple: {
        digits: ["1", "2", "3", "4"],
        onlyAddition: false,
        onlySubtraction: false
      },
      brothers: {
        digits: [],
        onlyAddition: false,
        onlySubtraction: false
      },
      friends: {
        digits: [],
        onlyAddition: false,
        onlySubtraction: false
      },
      mix: {
        digits: [],
        onlyAddition: false,
        onlySubtraction: false
      }
    },
    transition: "none",
    inline: false
  },
  results: {
    success: 0,
    total: 0,
    wrongExamples: [] // Массив неправильно решенных примеров
  }
};

// Private state
let _state = { ...defaultState };

/**
 * Initialize state from localStorage
 */
function initState() {
  if (storage.isAvailable()) {
    const savedSettings = storage.loadSettings();
    const savedLanguage = storage.loadLanguage();

    if (savedSettings) {
      _state.settings = deepMerge(defaultState.settings, savedSettings);
      logger.info(CONTEXT, 'Loaded settings from storage');
    }

    if (savedLanguage) {
      _state.language = savedLanguage;
      logger.info(CONTEXT, 'Loaded language from storage:', savedLanguage);
    }
  }
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Get current state (read-only copy)
 * @returns {AppState} Frozen copy of state
 */
export function getState() {
  return Object.freeze(JSON.parse(JSON.stringify(_state)));
}

/**
 * Get specific state property
 * @param {string} path - Dot notation path (e.g., 'settings.mode')
 * @returns {any} Value at path
 */
export function getStateValue(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], _state);
}

/**
 * Update state
 * @param {Partial<AppState>} updates - State updates
 * @param {boolean} persist - Whether to persist to localStorage
 */
export function setState(updates, persist = true) {
  const prevState = { ..._state };
  _state = deepMerge(_state, updates);

  // Persist to localStorage
  if (persist && storage.isAvailable()) {
    if (updates.settings) {
      storage.saveSettings(_state.settings);
    }
    if (updates.language) {
      storage.saveLanguage(_state.language);
    }
  }

  // Emit change event
  eventBus.emit(EVENTS.STATE_CHANGE, {
    previous: prevState,
    current: getState(),
    changes: updates
  });

  logger.debug(CONTEXT, 'State updated:', updates);
}

/**
 * Set route
 * @param {string} route - Route name
 */
export function setRoute(route) {
  if (_state.route === route) return;

  setState({ route }, false);
  eventBus.emit(EVENTS.ROUTE_CHANGE, route);
  logger.info(CONTEXT, 'Route changed to:', route);
}

/**
 * Set language preference
 * @param {string} language - Language code
 */
export function setLanguagePreference(language) {
  if (_state.language === language) return;

  setState({ language }, true);
  eventBus.emit(EVENTS.LANGUAGE_CHANGE, language);
  logger.info(CONTEXT, 'Language changed to:', language);
}

/**
 * Update settings
 * @param {Object} partial - Partial settings update
 */
export function updateSettings(partial) {
  const newSettings = deepMerge(_state.settings, partial);
  setState({ settings: newSettings }, true);
  eventBus.emit(EVENTS.SETTINGS_UPDATE, newSettings);
  logger.debug(CONTEXT, 'Settings updated:', partial);
}

/**
 * Set results
 * @param {Object} results - Training results
 */
export function setResults(results) {
  setState({ results: { ...results } }, false);
}

/**
 * Reset results
 */
export function resetResults() {
  setState({ results: { success: 0, total: 0, wrongExamples: [] } }, false);
}

/**
 * Reset all state to defaults
 */
export function resetState() {
  _state = { ...defaultState };
  storage.clear();
  eventBus.emit(EVENTS.STATE_CHANGE, {
    previous: getState(),
    current: getState(),
    changes: {}
  });
  logger.info(CONTEXT, 'State reset to defaults');
}

/**
 * Subscribe to state changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToState(callback) {
  return eventBus.on(EVENTS.STATE_CHANGE, callback);
}

/**
 * Subscribe to route changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToRoute(callback) {
  return eventBus.on(EVENTS.ROUTE_CHANGE, callback);
}

/**
 * Subscribe to settings changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToSettings(callback) {
  return eventBus.on(EVENTS.SETTINGS_UPDATE, callback);
}

// Initialize state on module load
initState();

// Export legacy `state` object for backward compatibility
// This will be deprecated and removed in future versions
export const state = new Proxy({}, {
  get(target, prop) {
    logger.warn(CONTEXT, 'Direct state access is deprecated. Use getState() instead.');
    return _state[prop];
  },
  set(target, prop, value) {
    logger.warn(CONTEXT, 'Direct state mutation is deprecated. Use setState() instead.');
    _state[prop] = value;
    return true;
  }
});

logger.info(CONTEXT, 'State management initialized');
