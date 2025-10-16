import { dictionaries, LANG_CODES } from "../i18n/dictionaries.js";

let currentLanguage = "ua";
const listeners = new Set();

function getFromDictionary(dict, path) {
  return path.split(".").reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, dict);
}

function notify() {
  listeners.forEach((listener) => listener(currentLanguage));
}

export async function initI18n(defaultLang = "ua") {
  currentLanguage = LANG_CODES.includes(defaultLang) ? defaultLang : "ua";
  return currentLanguage;
}

export function t(path, fallback) {
  const current = getFromDictionary(dictionaries[currentLanguage], path);
  if (current !== undefined) {
    return current;
  }
  if (fallback) {
    return fallback;
  }
  for (const code of LANG_CODES) {
    const fromOther = getFromDictionary(dictionaries[code], path);
    if (fromOther !== undefined) {
      return fromOther;
    }
  }
  return path;
}

export function setLanguage(code) {
  if (!LANG_CODES.includes(code) || code === currentLanguage) {
    return;
  }
  currentLanguage = code;
  notify();
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAvailableLanguages() {
  return LANG_CODES.map((code) => ({
    code,
    label: dictionaries[code]?.language || code.toUpperCase()
  }));
}