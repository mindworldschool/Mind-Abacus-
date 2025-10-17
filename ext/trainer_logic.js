// ext/trainer_logic.js - Логика тренажёра с новым SVG абакусом
import { ExampleView } from "./components/ExampleView.js";
import { Abacus } from "./components/AbacusNew.js";
import { generateExample } from "./core/generator.js";
import { startTimer, stopTimer } from "../js/utils/timer.js";
import { playSound } from "../js/utils/sound.js";

/**
 * Основная функция монтирования тренажёра
 * @param {HTMLElement} container - Контейнер для монтирования
 * @param {Object} context - { t, state }
 */
export function mountTrainerUI(container, { t, state }) {
  console.log("🎮 Монтируем UI тренажёра с новым SVG абакусом...");
  console.log("📋 Настройки:", state.settings);
  console.log("🔧 state.settings.inline =", state.settings.inline);

  const digits = parseInt(state.settings.digits, 10) || 1;

  // ИСПРАВЛЕНО: Добавляем +1 к количеству разрядов для абакуса
  const abacusDigits = digits + 1;

  console.log(`🧮 Разрядность примеров: ${digits}, разрядность абакуса: ${abacusDigits}`);

  // Определяем режим отображения из настроек
  const displayMode = state.settings.inline ? "inline" : "column";

  console.log("📐 РЕЖИМ ОТОБРАЖЕНИЯ:", displayMode);
  console.log("📐 КЛАСС trainer-main:", `trainer-main--${displayMode}`);

  // Создаём основной layout
  const layout = document.createElement("div");
  layout.className = `mws-trainer mws-trainer--${displayMode}`;

  layout.innerHTML = `
    <div class="trainer-main trainer-main--${displayMode}">
      <div id="area-example" class="example-view"></div>
      
      <div class="answer-section">
        <div class="answer-label">Ответ:</div>
        <input type="number" id="answer-input" placeholder="" />
        <button class="btn btn--primary" id="btn-submit">Ответить</button>
      </div>
    </div>
    
    <div id="panel-controls">
      <div class="results-capsule-extended">
        <div class="results-capsule-extended__header">
          <span class="results-capsule-extended__label">Примеры:</span>
          <span class="results-capsule-extended__counter">
            <span id="stats-completed">0</span> / 
            <span id="stats-total">${getExampleCount(state.settings)}</span>
          </span>
        </div>
        <div class="results-capsule">
          <div class="results-capsule__side results-capsule__side--correct">
            <div class="results-capsule__icon">✓</div>
            <div class="results-capsule__value" id="stats-correct">0</div>
          </div>
          <div class="results-capsule__divider"></div>
          <div class="results-capsule__side results-capsule__side--incorrect">
            <div class="results-capsule__icon">✗</div>
            <div class="results-capsule__value" id="stats-incorrect">0</div>
          </div>
        </div>
      </div>

      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-bar__correct" id="progress-correct" style="width: 0%;"></div>
          <div class="progress-bar__incorrect" id="progress-incorrect" style="width: 0%;"></div>
        </div>
        <div class="progress-label">
          <span class="progress-label__correct">Правильно: <strong id="percent-correct">0%</strong></span>
          <span class="progress-label__incorrect">Ошибки: <strong id="percent-incorrect">0%</strong></span>
        </div>
      </div>

      <div class="timer-capsule">
        <svg class="timer-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" stroke-width="2"/>
          <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M6 2l3 3M18 2l-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span id="timer">00:00</span>
      </div>

      <div class="panel-card panel-card--compact">
        <button class="btn btn--secondary btn--fullwidth" id="btn-show-abacus">
          🧮 Показать абакус
        </button>
      </div>
    </div>
  `;

  container.appendChild(layout);

  // Создаём плавающий контейнер для абакуса (правый нижний угол)
  const abacusWrapper = document.createElement("div");
  abacusWrapper.className = "abacus-wrapper";
  abacusWrapper.id = "abacus-wrapper";
  abacusWrapper.innerHTML = `
    <div class="abacus-header">
      <span class="abacus-title">🧮 Абакус</span>
      <button class="abacus-close-btn" id="btn-close-abacus" title="Закрыть">×</button>
    </div>
    <div id="floating-abacus-container"></div>
  `;
  document.body.appendChild(abacusWrapper);

  // Инициализация компонентов
  const exampleView = new ExampleView(document.getElementById("area-example"));
  const floatingAbacusContainer = document.getElementById("floating-abacus-container");
  const abacus = new Abacus(floatingAbacusContainer, { digitCount: abacusDigits });

  const shouldShowAbacus = state.settings.mode === "abacus";
  if (shouldShowAbacus) {
    abacusWrapper.classList.add("visible");
    document.getElementById("btn-show-abacus").textContent = "🧮 Скрыть абакус";
  }

  function toggleAbacusVisibility() {
    const isVisible = abacusWrapper.classList.contains("visible");
    const btn = document.getElementById("btn-show-abacus");
    if (isVisible) {
      abacusWrapper.classList.remove("visible");
      btn.textContent = "🧮 Показать абакус";
    } else {
      abacusWrapper.classList.add("visible");
      btn.textContent = "🧮 Скрыть абакус";
    }
  }

  const session = {
    currentExample: null,
    stats: {
      correct: 0,
      incorrect: 0,
      total: getExampleCount(state.settings),
    },
    completed: 0,
  };

  // === 📘 Основная функция отображения примеров ===
  function showNextExample() {
    if (session.completed >= session.stats.total) {
      finishSession();
      return;
    }

    session.currentExample = generateExample(state.settings);

    // Отображаем шаги
    exampleView.render(session.currentExample.steps, displayMode);

    // === 🔧 Адаптивные атрибуты для CSS ===
    const areaExample = document.getElementById("area-example");
    if (areaExample) {
      areaExample.setAttribute("data-digits", state.settings.digits || 1);
      areaExample.setAttribute(
        "data-actions",
        state.settings.actions?.count || state.settings.examples?.count || 10
      );
    }

    abacus.reset();

    const input = document.getElementById("answer-input");
    input.value = "";
    input.focus();

    startTimer("timer");

    console.log("📝 Новый пример. Ответ:", session.currentExample.answer);
  }

  function checkAnswer() {
    const input = document.getElementById("answer-input");
    const userAnswer = parseInt(input.value, 10);

    if (isNaN(userAnswer)) {
      alert("Пожалуйста, введи число");
      return;
    }

    stopTimer();

    const isCorrect = userAnswer === session.currentExample.answer;

    if (isCorrect) session.stats.correct++;
    else session.stats.incorrect++;

    session.completed++;
    updateStats();
    playSound(isCorrect ? "correct" : "wrong");

    setTimeout(() => {
      showNextExample();
    }, 500);
  }

  function updateStats() {
    const { correct, incorrect, total } = session.stats;
    const completed = session.completed;
    document.getElementById("stats-completed").textContent = completed;
    document.getElementById("stats-correct").textContent = correct;
    document.getElementById("stats-incorrect").textContent = incorrect;

    const percentCorrect = completed > 0 ? Math.round((correct / completed) * 100) : 0;
    const percentIncorrect = completed > 0 ? Math.round((incorrect / completed) * 100) : 0;

    document.getElementById("progress-correct").style.width = percentCorrect + "%";
    document.getElementById("progress-incorrect").style.width = percentIncorrect + "%";

    document.getElementById("percent-correct").textContent = percentCorrect + "%";
    document.getElementById("percent-incorrect").textContent = percentIncorrect + "%";
  }

  function finishSession() {
    abacusWrapper.classList.remove("visible");
    if (window.finishTraining) {
      window.finishTraining({
        correct: session.stats.correct,
        total: session.stats.total,
      });
    }
  }

  document.getElementById("btn-show-abacus").addEventListener("click", toggleAbacusVisibility);
  document.getElementById("btn-close-abacus").addEventListener("click", () => {
    abacusWrapper.classList.remove("visible");
    document.getElementById("btn-show-abacus").textContent = "🧮 Показать абакус";
  });

  document.getElementById("btn-submit").addEventListener("click", checkAnswer);
  document.getElementById("answer-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkAnswer();
  });

  // Первый пример
  showNextExample();

  console.log(`✅ Тренажёр запущен (${abacusDigits} стоек, ${digits}-значные числа)`);
}

/**
 * Получить количество примеров из настроек
 * @param {Object} settings
 * @returns {number}
 */
function getExampleCount(settings) {
  return settings.examples.infinite ? 10 : settings.examples.count;
}
