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

        <!-- Прогресс-бар для таймера ответа -->
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

    let isShowing = false;     // идёт ли диктант
    let showAbort = false;     // токен отмены диктанта

    // === Размер цифр ===
    function calculateFontSize(actions, maxDigits) {
      const baseSize = 120;
      const minSize = 35;
      const actionPenalty = 1.8;
      const digitPenalty = 3;
      let fontSize = baseSize - (actions * actionPenalty) - (maxDigits * digitPenalty);
      return Math.max(minSize, Math.min(baseSize, fontSize));
    }

    // === Генерация/показ примера ===
    async function showNextExample() {
      try {
        // Очистки на переходе
        stopAnswerTimer();
        overlay.clear();
        showAbort = true; // гасим любой текущий диктант (если был)
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

        exampleView.render(session.currentExample.steps, displayMode);

        // Адаптация размеров
        const actionsLen = session.currentExample.steps.length;
        let maxDigits = 1;
        for (const step of session.currentExample.steps) {
          const num = parseInt(String(step).replace(/[^\d-]/g, ""), 10);
          if (!isNaN(num)) maxDigits = Math.max(maxDigits, Math.abs(num).toString().length);
        }
        const fontSize = calculateFontSize(actionsLen, maxDigits);
        document.documentElement.style.setProperty("--example-font-size", `${fontSize}px`);

        // Подготовка поля ввода
        const input = document.getElementById("answer-input");
        input.value = "";

        // === ПОКАДРОВЫЙ ПОКАЗ ===
        const lockDuringShow = st.lockInputDuringShow !== false; // по умолчанию true
        input.disabled = lockDuringShow;
        if (st.showSpeedEnabled && st.showSpeedMs > 0) {
          isShowing = true;
          showAbort = false;
          await playSequential(session.currentExample.steps, st.showSpeedMs, {
            beepOnStep: !!st.beepOnStep
          });
          if (showAbort) return; // если прервано досрочным ответом
          await delay(st.showSpeedPauseAfterChainMs ?? 600);
          isShowing = false;
          if (lockDuringShow) {
            input.disabled = false;
            input.focus();
          }
        } else {
          // без диктанта
          input.disabled = false;
          input.focus();
        }

        // === ЗАПУСК ТАЙМЕРА ОТВЕТА ===
        if (st.timeLimitEnabled && st.timePerExampleMs > 0) {
          startAnswerTimer(st.timePerExampleMs, {
            onExpire: handleTimeExpired,
            textElementId: "answerTimerText",
            barSelector: "#answer-timer .bar"
          });
        }

        console.log("📝 Новый пример:", session.currentExample.steps, "Ответ:", session.currentExample.answer);
      } catch (e) {
        showFatalError(e);
      }
    }

    // === Проверка ответа ===
    function checkAnswer() {
      // если идёт диктант и ввод заблокирован — игнорируем
      if (isShowing && (st.lockInputDuringShow !== false)) return;

      const input = document.getElementById("answer-input");
      const userAnswer = parseInt(input.value, 10);
      if (isNaN(userAnswer)) {
        alert("Пожалуйста, введи число");
        return;
      }

      // если ответили во время диктанта при разрешённом вводе — прерываем показ
      if (isShowing && (st.lockInputDuringShow === false)) {
        showAbort = true;
        isShowing = false;
        overlay.clear();
      }

      stopAnswerTimer();

      const isCorrect = userAnswer === session.currentExample.answer;
      if (isCorrect) session.stats.correct++;
      else session.stats.incorrect++;
      session.completed++;
      updateStats();
      playSound(isCorrect ? "correct" : "wrong");

      setTimeout(() => showNextExample(), 500);
    }

    // === Обработка тайм-аута ===
    function handleTimeExpired() {
      const correct = session.currentExample?.answer;
      console.warn("⏳ Время вышло! Правильный ответ:", correct);
      if (st.beepOnTimeout) playSound("wrong"); // или отдельный звук timeout, если есть в ассетах
      session.stats.incorrect++;
      session.completed++;
      updateStats();
      setTimeout(() => showNextExample(), 800);
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

    // === Покадровый показ шагов ===
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

    // === Старт ===
    showNextExample();
    console.log(`✅ Тренажёр запущен (${abacusDigits} стоек, ${digits}-значные числа)`);

    // Возврат функции очистки при размонтировании
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

/** Показать фатальную ошибку */
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

/** Получить количество примеров */
function getExampleCount(examplesCfg) {
  if (!examplesCfg) return 10;
  return examplesCfg.infinite ? 10 : (examplesCfg.count ?? 10);
}

