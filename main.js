import {
  initI18n,
  t,
  setLanguage,
  getAvailableLanguages,
  getCurrentLanguage,
  onLanguageChange
} from "./core/i18n.js";
import {
  state,
  setRoute,
  updateSettings,
  setLanguagePreference
} from "./core/state.js";
import { renderSettings } from "./ui/settings.js";
import { renderConfirmation } from "./ui/confirmation.js";
import { renderGame } from "./ui/game.js";
import { renderResults } from "./ui/results.js";

const mainContainer = document.getElementById("app");
const titleElement = document.getElementById("appTitle");
const taglineElement = document.getElementById("appTagline");
const languageContainer = document.getElementById("languageSwitcher");
const footerElement = document.getElementById("appFooter");

const screens = {
  settings: renderSettings,
  confirmation: renderConfirmation,
  game: renderGame,
  results: renderResults
};

let currentCleanup = null;

function updateHeaderTexts() {
  titleElement.textContent = t("header.title");
  taglineElement.textContent = t("header.tagline");
  footerElement.textContent = t("footer");
  document.title = t("header.title");
  document.documentElement.lang = getCurrentLanguage();
}

function renderLanguageButtons() {
  const languages = getAvailableLanguages();
  languageContainer.innerHTML = "";
  const capsule = document.createElement("div");
  capsule.className = "language-capsule";

  languages.forEach(({ code, label }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = code.toUpperCase();
    button.title = label;
    button.dataset.lang = code;
    if (code === getCurrentLanguage()) {
      button.classList.add("language-capsule__btn--active");
    }
    button.addEventListener("click", () => {
      setLanguagePreference(code);
      setLanguage(code);
    });
    capsule.appendChild(button);
  });

  languageContainer.appendChild(capsule);
}

function renderScreen(name) {
  if (!screens[name]) {
    console.warn(`Unknown route: ${name}`);
    return;
  }

  if (typeof currentCleanup === "function") {
    currentCleanup();
    currentCleanup = null;
  }

  mainContainer.innerHTML = "";
  const context = {
    t,
    state,
    navigate: route,
    updateSettings
  };
  const cleanup = screens[name](mainContainer, context);
  if (typeof cleanup === "function") {
    currentCleanup = cleanup;
  }
}

export function route(name) {
  setRoute(name);
  renderScreen(name);
}

async function bootstrap() {
  await initI18n(state.language);
  updateHeaderTexts();
  renderLanguageButtons();
  route(state.route);

  onLanguageChange(() => {
    updateHeaderTexts();
    renderLanguageButtons();
    renderScreen(state.route);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to initialise application", error);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.route !== "settings") {
    route("settings");
  }
});

window.route = route;