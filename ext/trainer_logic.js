// ext/trainer_logic.js — Логика тренажёра с абакусом, таймером и покадровым показом
import { ExampleView } from "./components/ExampleView.js";
import { Abacus } from "./components/AbacusNew.js";
import { generateExample } from "./core/generator.js";
import { startAnswerTimer, stopAnswerTimer } from "../js/utils/timer.js";
import { BigStepOverlay } from "../ui/components/BigStepOverlay.js";
import { playSound } from "../js/utils/sound.js";

/**
 * Основная функция монтирования тренажёра
 * @param {HTMLElement} container - Контейнер для монтирования
 * @param {Object} context - { t, state }
 */
export function mountTrainerUI(container, { t, state }) {
  try {
    console.log("🎮 Монтируем UI тренажёра (Abacus + Таймер + Диктант)...");
    console.log("📋 Настройки:", state?.settings);

    const st = state?.settings ?? {};
    const actionsCfg = st.actions ?? {};
    const examplesCfg = st.examples ?? {};
    const blockSimpleDigits = Array.isArray(st?.blocks?.simple?.digits)
      ? st.blocks.simple.digits
      : [];

    const digits = parseInt(st.digits, 10) || 1;
    const abacusDigits = digits + 1;
    const displayMode = st.inline ? "inline" : "column";

    // === Layout ===
    const layout = document.createElement("div");
    layout.className = `mws-trainer mws-trainer--${displayMode}`;
    layout.innerHTML = `
      <div class="trainer-main trainer-main--${displayMode}">
        <div id="area-example" class="example-view"></div>
      </div>
      <div id="panel-controls">
        <div class="answer-section-panel">
          <div class="answer-label">Ответ:</div>
          <input type="number" id="answer-input" placeholder="" />
          <button class="btn btn--primary" id="btn-submit">Ответить</button>
        </div>

        <div class="results-capsule-extended">
          <div class="results-capsule-extended__header">
            <span class="results-capsule-extended__label">Примеры:</span>
            <span class="results-capsule-extended__counter">
              <span id="stats-completed">0</span> /
              <span id="stats-total">${getExampleCount(examplesCfg)}</span>
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
            <div class="progress-bar__correct" id="progress-correct" style="width:0%;"></div>
            <div class="progress-bar__incorrect" id="progress-incorrect" style="width:0%;"></div>
          </div>
          <div class="progress-label">
            <span class="progress-label__correct">Правильно: <strong id="percent-correct">0%</strong></span>
            <span class="progress-label__incorrect">Ошибки: <strong id="percent-incorrect">0%</strong></span>
          </div>
        </div>

        <!-- Прогресс-бар для таймера -->
        <div id="answer-timer">
          <div class="bar"></div>
        </div>
        <div id="answerTimerText" class="answer-timer__text"></div>

        <div class="panel-card panel-card--compact">
          <button class="btn btn--secondary btn--fullwidth" id="btn-show-abacus">🧮 Показать абакус</button>
        </div>
      </div>
    `;
    container.appendChild(layout);

    // === Абакус ===
    const oldAbacus = document.getElementById("abacus-wrapper");
    if (oldAbacus) oldAbacus.remove();

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

    const exampleView = new ExampleView(document.getElementById("area-example"));
    const abacus = new Abacus(document.getElementById("floating-abacus-container"), {
      digitCount: abacusDigits
    });

    const overlayColor =
      getComputedStyle(document.documentElement).getPropertyValue("--color-primary")?.trim() || "#EC8D00";
    const overlay = new BigStepOverlay(st.bigDigitScale ?? 1.15, overlayColor);

    // --- Центрирование крупной цифры внутри белого блока ---
const mainBlock = layout.querySelector(".trainer-main");

if (overlay?.el && mainBlock) {
  mainBlock.style.position = "relative"; // чтобы позиционирование шло относительно блока
  overlay.el.style.position = "absolute";
  overlay.el.style.left = "50%";
  overlay.el.style.top = "50%";
  overlay.el.style.transform = "translate(-50%, -50%)";
  overlay.el.style.zIndex = "10";
  overlay.el.style.pointerEvents = "none";

  // Вставляем overlay внутрь белого блока
  mainBlock.appendChild(overlay.el);
}
   
    const shouldShowAbacus = st.mode === "abacus";
    if (shouldShowAbacus) {
      abacusWrapper.classList.add("visible");
      document.getElementById("btn-show-abacus").textContent = "🧮 Скрыть абакус";
    }

    // === Состояние ===
    const session = {
      currentExample: null,
      stats: { correct: 0, incorrect: 0, total: getExampleCount(examplesCfg) },
      completed: 0
    };

    let isShowing = false;
    let showAbort = false;

    // === Генерация и показ примера ===
    async function showNextExample() {
      try {
        overlay.clear();
        showAbort = true;
        isShowing = false;

        if (session.completed >= session.stats.total) {
          finishSession();
          return;
        }

        const selectedDigits =
          blockSimpleDigits.length > 0
            ? blockSimpleDigits.map(d => parseInt(d, 10))
            : [1, 2, 3, 4];

        session.currentExample = generateExample({
          blocks: { simple: { digits: selectedDigits } },
          actions: {
            min: actionsCfg.infinite ? 2 : (actionsCfg.count ?? 2),
            max: actionsCfg.infinite ? 5 : (actionsCfg.count ?? 2)
          }
        });

        if (!session.currentExample || !Array.isArray(session.currentExample.steps))
          throw new Error("Пустой пример");

        // === В режиме скорости показа не показываем список примера ===
        const exampleHost = document.getElementById("area-example");
        if (st.showSpeedEnabled && st.showSpeedMs > 0) {
          if (exampleHost) exampleHost.innerHTML = ""; // скрыть список
        } else {
          exampleView.render(session.currentExample.steps, displayMode);
        }

        const input = document.getElementById("answer-input");
        input.value = "";

        const lockDuringShow = st.lockInputDuringShow !== false;
        input.disabled = lockDuringShow;

        if (st.showSpeedEnabled && st.showSpeedMs > 0) {
          isShowing = true;
          showAbort = false;
          await playSequential(session.currentExample.steps, st.showSpeedMs, {
            beepOnStep: !!st.beepOnStep
          });
          if (showAbort) return;
          await delay(st.showSpeedPauseAfterChainMs ?? 600);
          isShowing = false;
          if (lockDuringShow) {
            input.disabled = false;
            input.focus();
          }
        } else {
          input.disabled = false;
          input.focus();
        }

        console.log("📝 Новый пример:", session.currentExample.steps, "Ответ:", session.currentExample.answer);
      } catch (e) {
        showFatalError(e);
      }
    }

    // === Проверка ответа ===
    function checkAnswer() {
      if (isShowing && (st.lockInputDuringShow !== false)) return;

      const input = document.getElementById("answer-input");
      const userAnswer = parseInt(input.value, 10);
      if (isNaN(userAnswer)) {
        alert("Пожалуйста, введи число");
        return;
      }

      if (isShowing && (st.lockInputDuringShow === false)) {
        showAbort = true;
        isShowing = false;
        overlay.clear();
      }

      const isCorrect = userAnswer === session.currentExample.answer;
      if (isCorrect) session.stats.correct++;
      else session.stats.incorrect++;
      session.completed++;
      updateStats();
      playSound(isCorrect ? "correct" : "wrong");

      if (session.completed >= session.stats.total) {
        finishSession();
        return;
      }

      setTimeout(() => showNextExample(), 500);
    }

    // === Обновление статистики ===
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
      stopAnswerTimer();
      showAbort = true;
      isShowing = false;
      overlay.clear();
      abacusWrapper.classList.remove("visible");
      if (window.finishTraining) {
        window.finishTraining({
          correct: session.stats.correct,
          total: session.stats.total
        });
      }
    }

    async function playSequential(steps, intervalMs, { beepOnStep = false } = {}) {
      try {
        for (const s of steps) {
          if (showAbort) break;
          overlay.show(formatStep(s));
          if (beepOnStep) playSound("tick");
          await delay(intervalMs);
          overlay.hide();
          await delay(40);
        }
      } finally {
        overlay.clear();
      }
    }

    function formatStep(step) {
      const n = Number(step);
      if (Number.isNaN(n)) return String(step);
      return n >= 0 ? `+${n}` : `${n}`;
    }

    function delay(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

    // === События ===
    document.getElementById("btn-show-abacus").addEventListener("click", () => {
      abacusWrapper.classList.toggle("visible");
      const btn = document.getElementById("btn-show-abacus");
      btn.textContent = abacusWrapper.classList.contains("visible")
        ? "🧮 Скрыть абакус"
        : "🧮 Показать абакус";
    });
    document.getElementById("btn-close-abacus").addEventListener("click", () => {
      abacusWrapper.classList.remove("visible");
      document.getElementById("btn-show-abacus").textContent = "🧮 Показать абакус";
    });
    document.getElementById("btn-submit").addEventListener("click", checkAnswer);
    document.getElementById("answer-input").addEventListener("keypress", (e) => {
      if (e.key === "Enter") checkAnswer();
    });

    // === Глобальный таймер серии (если включен режим "Ограничение времени") ===
    if (st.timeLimitEnabled && st.timePerExampleMs > 0 && !st.showSpeedEnabled) {
      console.log("⏱ Запускаем глобальный таймер серии:", st.timePerExampleMs, "мс");
      startAnswerTimer(st.timePerExampleMs, {
        textElementId: "answerTimerText",
        barSelector: "#answer-timer .bar",
        onExpire: () => {
          console.warn("⏰ Время серии истекло!");
          finishSession();
        }
      });
    }

    // === Старт ===
    showNextExample();
    console.log(`✅ Тренажёр запущен (${abacusDigits} стоек, ${digits}-значные числа)`);

    return () => {
      const wrapper = document.getElementById("abacus-wrapper");
      if (wrapper) wrapper.remove();
      showAbort = true;
      isShowing = false;
      overlay.clear();
      stopAnswerTimer();
    };

  } catch (err) {
    showFatalError(err);
  }
}

function showFatalError(err) {
  const msg = err?.stack || err?.message || String(err);
  console.error("Ошибка загрузки тренажёра:", err);
  const host = document.querySelector(".screen__body") || document.body;
  host.insertAdjacentHTML(
    "afterbegin",
    `<div style="color:#d93025;padding:16px;white-space:pre-wrap">
      <b>Не удалось загрузить тренажёр.</b><br/>${msg}
    </div>`
  );
}

function getExampleCount(examplesCfg) {
  if (!examplesCfg) return 10;
  return examplesCfg.infinite ? 10 : (examplesCfg.count ?? 10);
}

