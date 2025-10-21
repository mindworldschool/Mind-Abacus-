export const state = {
  route: "settings",
  language: "ua",
  settings: {
    mode: "mental", // По умолчанию "Устно"
    digits: "1",
    combineLevels: false,
    actions: { count: 1, infinite: false },
    examples: { count: 2, infinite: false },
    timeLimit: "off",
    speed: "off",
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
        digits: ["1", "2", "3", "4"], // По умолчанию пусто
        onlyAddition: false,
        onlySubtraction: false
      },
      brothers: {
        digits: [], // По умолчанию пусто
        onlyAddition: false,
        onlySubtraction: false
      },
      friends: {
        digits: [], // По умолчанию пусто
        onlyAddition: false,
        onlySubtraction: false
      },
      mix: {
        digits: [], // По умолчанию пусто
        onlyAddition: false,
        onlySubtraction: false
      }
    },
    transition: "none",
    inline: false // По умолчанию столбик
  },
  results: {
    success: 0,
    total: 0
  }
};

export function setRoute(route) {
  state.route = route;
}

export function setLanguagePreference(language) {
  state.language = language;
}

export function updateSettings(partial) {
  state.settings = { ...state.settings, ...partial };
}

export function setResults(results) {
  state.results = { ...results };
}

export function resetResults() {
  state.results = { success: 0, total: 0 };
}
