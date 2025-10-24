/**
 * LocalStorage utility for persistent state
 * Handles serialization, deserialization, and error handling
 */

import { STORAGE_KEYS } from './constants.js';
import { logger } from './logger.js';

const CONTEXT = 'Storage';

/**
 * Save data to localStorage
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {boolean} Success status
 */
export function saveToStorage(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    logger.debug(CONTEXT, `Saved to storage: ${key}`);
    return true;
  } catch (error) {
    logger.error(CONTEXT, `Failed to save to storage: ${key}`, error);
    return false;
  }
}

/**
 * Load data from localStorage
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} Stored value or default value
 */
export function loadFromStorage(key, defaultValue = null) {
  try {
    const serialized = localStorage.getItem(key);
    if (serialized === null) {
      return defaultValue;
    }
    const value = JSON.parse(serialized);
    logger.debug(CONTEXT, `Loaded from storage: ${key}`);
    return value;
  } catch (error) {
    logger.error(CONTEXT, `Failed to load from storage: ${key}`, error);
    return defaultValue;
  }
}

/**
 * Remove data from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} Success status
 */
export function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    logger.debug(CONTEXT, `Removed from storage: ${key}`);
    return true;
  } catch (error) {
    logger.error(CONTEXT, `Failed to remove from storage: ${key}`, error);
    return false;
  }
}

/**
 * Clear all application data from localStorage
 */
export function clearStorage() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    logger.info(CONTEXT, 'Cleared all application storage');
    return true;
  } catch (error) {
    logger.error(CONTEXT, 'Failed to clear storage', error);
    return false;
  }
}

/**
 * Check if localStorage is available
 * @returns {boolean} Availability status
 */
export function isStorageAvailable() {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// Convenience methods for app-specific keys
export const storage = {
  saveSettings: (settings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings),
  loadSettings: (defaults) => loadFromStorage(STORAGE_KEYS.SETTINGS, defaults),
  saveLanguage: (language) => saveToStorage(STORAGE_KEYS.LANGUAGE, language),
  loadLanguage: (defaultLang) => loadFromStorage(STORAGE_KEYS.LANGUAGE, defaultLang),
  saveResultsHistory: (history) => saveToStorage(STORAGE_KEYS.RESULTS_HISTORY, history),
  loadResultsHistory: () => loadFromStorage(STORAGE_KEYS.RESULTS_HISTORY, []),
  clear: clearStorage,
  isAvailable: isStorageAvailable
};

export default storage;
