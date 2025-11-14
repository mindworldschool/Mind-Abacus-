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

// 🔹 Определяем язык: URL → localStorage → default
function resolveInitialLanguage(defaultLang = "ua") {
  let lang = defaultLang;

  try {
    // 1. Пробуем взять из URL ?lang=en / ?lang=ua
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    if (urlLang && LANG_CODES.includes(urlLang)) {
      lang = urlLang;
    } else {
      // 2. Если в URL нет — пробуем из localStorage
      const saved = localStorage.getItem("mws_lang");
      if (saved && LANG_CODES.includes(saved)) {
        lang = saved;
      }
    }
  } catch (e) {
    // ничего страшного, просто идём дальше
  }

  // 3. Проверяем, что язык допустимый
  if (!LANG_CODES.includes(lang)) {
    lang = "ua";
  }

  return lang;
}

export async function initI18n(defaultLang = "ua") {
  const lang = resolveInitialLanguage(defaultLang);
  currentLanguage = lang;

  try {
    localStorage.setItem("mws_lang", lang);
  } catch (e) {
    // можно игнорировать
  }

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

  try {
    localStorage.setItem("mws_lang", code);
  } catch (e) {}

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
