// ext/trainer_logic.js — Improved trainer logic with security fixes
import { ExampleView } from "./components/ExampleView.js";
import { Abacus } from "./components/AbacusNew.js";
import { generateExample } from "./core/generator.js"; // <— как у тебя (не трогаю)
import { startAnswerTimer, stopAnswerTimer } from "../js/utils/timer.js";
import { BigStepOverlay } from "../ui/components/BigStepOverlay.js";
import { playSound } from "../js/utils/sound.js";
import { logger } from "../core/utils/logger.js";
import { UI, FONT_SIZE, DEFAULTS } from "../core/utils/constants.js";
import { eventBus, EVENTS } from "../core/utils/events.js"; // путь оставляю как у тебя
import toast from "../ui/components/Toast.js";

const CONTEXT = 'Trainer';

/**
 * Create layout structure using createElement (secure)
 */
function createTrainerLayout(displayMode, exampleCount) {
  const layout = document.createElement("div");
  layout.className = `mws-trainer mws-trainer--${displayMode}`;

  // Main area
  const trainerMain = document.createElement("div");
  trainerMain.className = `trainer-main trainer-main--${displayMode}`;

  const exampleArea = document.createElement("div");
  exampleArea.id = "area-example";
  exampleArea.className = "example-view";
  trainerMain.appendChild(exampleArea);

  // Controls panel
  const panelControls = document.createElement("div");
  panelControls.id = "panel-controls";

  // Answer section
  const answerSection = document.createElement("div");
  answerSection.className = "answer-section-panel";

  const answerLabel = document.createElement("div");
  answerLabel.className = "answer-label";
  answerLabel.textContent = "Ответ:";

  const answerInput = document.createElement("input");
  answerInput.type = "number";
  answerInput.id = "answer-input";
  answerInput.placeholder = "";

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn--primary";
  submitBtn.id = "btn-submit";
  submitBtn.textContent = "Ответить";

  answerSection.append(answerLabel, answerInput, submitBtn);

  // Results capsule
  const resultsCapsuleExt = createResultsCapsule(exampleCount);

  // Progress container
  const progressContainer = createProgressContainer();

  // Timer
  const timerContainer = document.createElement("div");
  timerContainer.id = "answer-timer";
  const timerBar = document.createElement("div");
  timerBar.className = "bar";
  timerContainer.appendChild(timerBar);

  const timerText = document.createElement("div");
  timerText.id = "answerTimerText";
  timerText.className = "answer-timer__text";

  // Abacus toggle
  const panelCard = document.createElement("div");
  panelCard.className = "panel-card panel-card--compact";
  const abacusBtn = document.createElement("button");
  abacusBtn.className = "btn btn--secondary btn--fullwidth";
  abacusBtn.id = "btn-show-abacus";
  abacusBtn.textContent = "🧮 Показать абакус";
  panelCard.appendChild(abacusBtn);

  panelControls.append(
    answerSection,
    resultsCapsuleExt,
    progressContainer,
    timerContainer,
    timerText,
    panelCard
  );

  layout.append(trainerMain, panelControls);
  return layout;
}

function createResultsCapsule(exampleCount) {
  const container = document.createElement("div");
  container.className = "results-capsule-extended";

  const header = document.createElement("div");
  header.className = "results-capsule-extended__header";

  const label = document.createElement("span");
  label.className = "results-capsule-extended__label";
  label.textContent = "Примеры:";

  const counter = document.createElement("span");
  counter.className = "results-capsule-extended__counter";

  const completed = document.createElement("span");
  completed.id = "stats-completed";
  completed.textContent = "0";

  const total = document.createElement("span");
  total.id = "stats-total";
  total.textContent = String(exampleCount);

  counter.append(completed, " / ", total);
  header.append(label, counter);

  const capsule = document.createElement("div");
  capsule.className = "results-capsule";

  // Correct side
  const correctSide = document.createElement("div");
  correctSide.className = "results-capsule__side results-capsule__side--correct";
  const correctIcon = document.createElement("div");
  correctIcon.className = "results-capsule__icon";
  correctIcon.textContent = "✓";
  const correctValue = document.createElement("div");
  correctValue.className = "results-capsule__value";
  correctValue.id = "stats-correct";
  correctValue.textContent = "0";
  correctSide.append(correctIcon, correctValue);

  const divider = document.createElement("div");
  divider.className = "results-capsule__divider";

  // Incorrect side
  const incorrectSide = document.createElement("div");
  incorrectSide.className = "results-capsule__side results-capsule__side--incorrect";
  const incorrectIcon = document.createElement("div");
  incorrectIcon.className = "results-capsule__icon";
  incorrectIcon.textContent = "✗";
  const incorrectValue = document.createElement("div");
  incorrectValue.className = "results-capsule__value";
  incorrectValue.id = "stats-incorrect";
  incorrectValue.textContent = "0";
  incorrectSide.append(incorrectIcon, incorrectValue);

  capsule.append(correctSide, divider, incorrectSide);
  container.append(header, capsule);
  return container;
}

function createProgressContainer() {
  const container = document.createElement("div");
  container.className = "progress-container";

  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";

  const correctBar = document.createElement("div");
  correctBar.className = "progress-bar__correct";
  correctBar.id = "progress-correct";
  correctBar.style.width = "0%";

  const incorrectBar = document.createElement("div");
  incorrectBar.className = "progress-bar__incorrect";
  incorrectBar.id = "progress-incorrect";
  incorrectBar.style.width = "0%";

  progressBar.append(correctBar, incorrectBar);

  const labels = document.createElement("div");
  labels.className = "progress-label";

  const correctLabel = document.createElement("span");
  correctLabel.className = "progress-label__correct";
  correctLabel.textContent = "Правильно: ";
  const correctPercent = document.createElement("strong");
  correctPercent.id = "percent-correct";
  correctPercent.textContent = "0%";
  correctLabel.appendChild(correctPercent);

  const incorrectLabel = document.createElement("span");
  incorrectLabel.className = "progress-label__incorrect";
  incorrectLabel.textContent = "Ошибки: ";
  const incorrectPercent = document.createElement("strong");
  incorrectPercent.id = "percent-incorrect";
  incorrectPercent.textContent = "0%";
  incorrectLabel.appendChild(incorrectPercent);

  labels.append(correctLabel, incorrectLabel);
  container.append(progressBar, labels);
  return container;
}

function createAbacusWrapper() {
  const wrapper = document.createElement("div");
  wrapper.className = "abacus-wrapper";
  wrapper.id = "abacus-wrapper";

  const header = document.createElement("div");
  header.className = "abacus-header";

  const title = document.createElement("span");
  title.className = "abacus-title";
  title.textContent = "🧮 Абакус";

  const closeBtn = document.createElement("button");
  closeBtn.className = "abacus-close-btn";
  closeBtn.id = "btn-close-abacus";
  closeBtn.title = "Закрыть";
  closeBtn.textContent = "×";

  header.append(title, closeBtn);

  const container = document.createElement("div");
  container.id = "floating-abacus-container";

  wrapper.append(header, container);
  return wrapper;
}

/**
 * Main trainer mounting function
 * @param {HTMLElement} container - Container element
 * @param {Object} context - { t, state }
 * @returns {Function} Cleanup function
 */
export function mountTrainerUI(container, { t, state }) {
  try {
    logger.info(CONTEXT, 'Mounting trainer UI...');
    logger.debug(CONTEXT, 'Settings:', state?.settings);

    const st = state?.settings ?? {};
    const actionsCfg = st.actions ?? {};
    const examplesCfg = st.examples ?? {};
    const blockSimpleDigits = Array.isArray(st?.blocks?.simple?.digits)
      ? st.blocks.simple.digits
      : [];

    const digits = parseInt(st.digits, 10) || 1; // выбранная разрядность для примеров
    const abacusColumns = digits + 1;            // 🧮 методически: на одну стойку больше
    const displayMode = st.inline ? "inline" : "column";

    // === Режим пересчета ошибок (расширен) ===
    // Если в state.retryMode уже пришёл список — играем его.
    // Иначе после первой серии — автоматически запустим retry со всеми неправильными.
    const retryModeInit = state?.retryMode?.enabled || false;
    const retryExamplesInit = retryModeInit ? (state?.retryMode?.examples || []) : [];
    const exampleCount = retryModeInit ? retryExamplesInit.length : getExampleCount(examplesCfg);

    logger.info(CONTEXT, `Retry mode (initial): ${retryModeInit}, examples to retry: ${retryExamplesInit.length}`);

    // === Create Layout (secure) ===
    const layout = createTrainerLayout(displayMode, exampleCount, t);
    container.appendChild(layout);

    // === Create Abacus ===
    const oldAbacus = document.getElementById("abacus-wrapper");
    if (oldAbacus) oldAbacus.remove();

    const abacusWrapper = createAbacusWrapper();
    document.body.appendChild(abacusWrapper);

    const exampleView = new ExampleView(document.getElementById("area-example"));

    // 🔧 Кол-во стоек = digits + 1
    const abacus = new Abacus(
      document.getElementById("floating-abacus-container"),
      abacusColumns
    );

    const overlayColor =
      getComputedStyle(document.documentElement).getPropertyValue("--color-primary")?.trim() || "#EC8D00";
    const overlay = new BigStepOverlay(st.bigDigitScale ?? UI.BIG_DIGIT_SCALE, overlayColor);

    const shouldShowAbacus = st.mode === "abacus";
    if (shouldShowAbacus) {
      abacusWrapper.classList.add("visible");
      const btn = document.getElementById("btn-show-abacus");
      if (btn) btn.textContent = t?.("trainer.hideAbacus") || "🧮 Скрыть абакус";
    }

    // === State ===
    const session = {
      currentExample: null,
      stats: { correct: 0, incorrect: 0, total: exampleCount },
      completed: 0,
      wrongExamples: [],
      retryPhase: retryModeInit ? "retry" : "main",      // "main" → "retry" → "done"
      retryQueue: retryModeInit ? [...retryExamplesInit] : []
    };

    let isShowing = false;
    let showAbort = false;

    // === Font size calculation ===
    function calculateFontSize(actions, maxDigits) {
      let fontSize = FONT_SIZE.BASE_SIZE -
                     (actions * FONT_SIZE.ACTION_PENALTY) -
                     (maxDigits * FONT_SIZE.DIGIT_PENALTY);
      return Math.max(FONT_SIZE.MIN_SIZE, Math.min(FONT_SIZE.BASE_SIZE, fontSize));
    }

    // === Adaptive font size for example display ===
    function adaptExampleFontSize(actionsCount, maxDigits) {
      const exampleLines = document.querySelectorAll('#area-example .example__line');

      logger.debug(CONTEXT, `adaptExampleFontSize called: ${exampleLines.length} lines found, actions: ${actionsCount}, digits: ${maxDigits}`);

      if (!exampleLines.length) return;

      // Base calculation considering both actions and digits
      const actionsFactor = Math.min(actionsCount, 12) / 12; // 0..1
      const digitsFactor = Math.min(maxDigits, 9) / 9;       // 0..1
      const complexityFactor = (actionsFactor + digitsFactor) / 2;

      // Font size range: 24px → 96px
      const minFontSize = 24;
      const maxFontSize = 96;
      const fontSize = maxFontSize - (complexityFactor * (maxFontSize - minFontSize));

      exampleLines.forEach(line => {
        line.style.setProperty('font-size', `${Math.round(fontSize)}px`, 'important');
        line.style.setProperty('line-height', '1.2', 'important');
      });

      logger.debug(CONTEXT, `Font size: ${Math.round(fontSize)}px (actions: ${actionsCount}, digits: ${maxDigits})`);
    }

    // === Show next example ===
    async function showNextExample() {
      try {
        overlay.clear();
        showAbort = true;
        isShowing = false;

        // Вычисляем текущий лимит серии для активной фазы
        const currentTotal = session.stats.total;

        if (session.completed >= currentTotal) {
          // Перешли в конец текущей фазы (main или retry)
          return finishPhase();
        }

        // === 1) Если мы в retry-фазе: берём из очереди уже сохранённые примеры
        if (session.retryPhase === "retry") {
          const ex = session.retryQueue[session.completed]; // индекс по ходу фазы
          if (!ex) {
            // Нет примеров — завершаем фазу
            return finishPhase();
          }
          session.currentExample = ex.example; // структура как сохраняли в wrongExamples
          logger.info(CONTEXT, `Retry example ${session.completed + 1}/${session.retryQueue.length}`);
        } else {
          // === 2) Обычная фаза: генерируем новый пример ===
          const selectedDigits =
            blockSimpleDigits.length > 0
              ? blockSimpleDigits.map(d => parseInt(d, 10))
              : [1, 2, 3, 4];

          const generatorSettings = {
            blocks: {
              simple: {
                digits: selectedDigits,
                includeFive:
                  (st.blocks?.simple?.includeFive ?? selectedDigits.includes(5)),
                onlyAddition:
                  (st.blocks?.simple?.onlyAddition ?? false),
                onlySubtraction:
                  (st.blocks?.simple?.onlySubtraction ?? false)
              },
              brothers: {
                active: st.blocks?.brothers?.active ?? false
              },
              friends: {
                active: st.blocks?.friends?.active ?? false
              },
              mix: {
                active: st.blocks?.mix?.active ?? false
              }
            },

            actions: {
              min: actionsCfg.infinite
                ? DEFAULTS.ACTIONS_MIN
                : (actionsCfg.count ?? DEFAULTS.ACTIONS_MIN),
              max: actionsCfg.infinite
                ? DEFAULTS.ACTIONS_MAX
                : (actionsCfg.count ?? DEFAULTS.ACTIONS_MAX)
            },

            // сколько разрядов (1..9)
            digits: st.digits,

            // использовать ли несколько разрядов одновременно при построении шага
            combineLevels: st.combineLevels || false
          };

          logger.info(
            CONTEXT,
            `Generating example (phase=${session.retryPhase}) digits=${st.digits}, combineLevels=${st.combineLevels}, blocks=`,
            generatorSettings.blocks
          );

          // Оставляю твой рабочий генератор:
          session.currentExample = generateExample(generatorSettings);
        }

        if (!session.currentExample || !Array.isArray(session.currentExample.steps))
          throw new Error("Empty example generated");

        const actionsLen = session.currentExample.steps.length;
        let maxDigits = 1;
        for (const step of session.currentExample.steps) {
          const num = parseInt(String(step).replace(/[^\d-]/g, ""), 10);
          if (!isNaN(num)) maxDigits = Math.max(maxDigits, Math.abs(num).toString().length);
        }

        const input = document.getElementById("answer-input");
        if (input) input.value = "";

        // === Auto-dictation for >12 actions ===
        const shouldUseDictation = actionsLen > 12;
        const effectiveShowSpeed = shouldUseDictation ? 2000 : (st.showSpeedMs || 0);
        const showSpeedActive = st.showSpeedEnabled && effectiveShowSpeed > 0;

        // === Hide example view when speed is enabled or dictation mode ===
        if (showSpeedActive || shouldUseDictation) {
          exampleView.clear();
        } else {
          exampleView.render(session.currentExample.steps, displayMode);
          requestAnimationFrame(() => {
            adaptExampleFontSize(actionsLen, maxDigits);
          });
        }

        // === Sequential display ===
        const lockDuringShow = st.lockInputDuringShow !== false;
        if (input) input.disabled = lockDuringShow;

        if (showSpeedActive || shouldUseDictation) {
          isShowing = true;
          showAbort = false;
          await playSequential(session.currentExample.steps, effectiveShowSpeed, {
            beepOnStep: !!st.beepOnStep
          });
          if (showAbort) return;
          await delay(st.showSpeedPauseAfterChainMs ?? UI.PAUSE_AFTER_CHAIN_MS);
          isShowing = false;
          if (lockDuringShow && input) {
            input.disabled = false;
            input.focus();
          }
        } else {
          if (input) {
            input.disabled = false;
            input.focus();
          }
        }

        logger.debug(
          CONTEXT,
          'New example:',
          session.currentExample.steps,
          'Answer:',
          session.currentExample.answer,
          'Phase:',
          session.retryPhase
        );
      } catch (e) {
        showFatalError(e);
      }
    }

    // === Check answer ===
    function checkAnswer() {
      if (isShowing && (st.lockInputDuringShow !== false)) return;

      const input = document.getElementById("answer-input");
      const userAnswer = parseInt(input?.value ?? "", 10);

      if (isNaN(userAnswer)) {
        toast.warning("Пожалуйста, введите число");
        return;
      }

      if (isShowing && (st.lockInputDuringShow === false)) {
        showAbort = true;
        isShowing = false;
        overlay.clear();
      }

      const isCorrect = userAnswer === session.currentExample.answer;
      if (isCorrect) {
        session.stats.correct++;
      } else {
        session.stats.incorrect++;
        // сохраняем для последующего retry (ровно этот же пример)
        session.wrongExamples.push({
          example: session.currentExample,
          userAnswer: userAnswer
        });
      }
      session.completed++;
      updateStats();
      playSound(isCorrect ? "correct" : "wrong");

      setTimeout(() => showNextExample(), UI.TRANSITION_DELAY_MS);
    }

    // === Handle timeout (оставляю как есть) ===
    function handleTimeExpired() {
      const correct = session.currentExample?.answer;
      logger.warn(CONTEXT, 'Time expired! Correct answer:', correct);
      if (st.beepOnTimeout) playSound("wrong");
      session.stats.incorrect++;
      if (session.currentExample) {
        session.wrongExamples.push({
          example: session.currentExample,
          userAnswer: null
        });
      }
      session.completed++;
      updateStats();
      setTimeout(() => showNextExample(), UI.TIMEOUT_DELAY_MS);
    }

    // === Update stats ===
    function updateStats() {
      const { correct, incorrect, total } = session.stats;
      const completed = session.completed;
      const el = (id) => document.getElementById(id);

      el("stats-completed") && (el("stats-completed").textContent = String(completed));
      el("stats-correct") && (el("stats-correct").textContent = String(correct));
      el("stats-incorrect") && (el("stats-incorrect").textContent = String(incorrect));

      const percentCorrect = completed > 0 ? Math.round((correct / completed) * 100) : 0;
      const percentIncorrect = completed > 0 ? Math.round((incorrect / completed) * 100) : 0;

      el("progress-correct") && (el("progress-correct").style.width = percentCorrect + "%");
      el("progress-incorrect") && (el("progress-incorrect").style.width = percentIncorrect + "%");
      el("percent-correct") && (el("percent-correct").textContent = percentCorrect + "%");
      el("percent-incorrect") && (el("percent-incorrect").textContent = percentIncorrect + "%");
    }

    // === Завершение фазы (main → retry → done) ===
    function finishPhase() {
      stopAnswerTimer();
      showAbort = true;
      isShowing = false;
      overlay.clear();
      abacusWrapper.classList.remove("visible");

      // Если мы только что завершили "main" — и есть ошибки — запускаем retry автоматически
      if (session.retryPhase === "main" && session.wrongExamples.length > 0) {
        logger.info(CONTEXT, `Main phase finished. Starting retry with ${session.wrongExamples.length} examples.`);
        // Подготовка retry
        session.retryPhase = "retry";
        session.retryQueue = [...session.wrongExamples]; // ровно те же примеры
        session.wrongExamples = [];
        session.completed = 0;
        session.stats = { correct: 0, incorrect: 0, total: session.retryQueue.length };

        // Обновим “всего” в UI
        const totalEl = document.getElementById("stats-total");
        if (totalEl) totalEl.textContent = String(session.stats.total);
        updateStats();

        // Запускаем заново показ
        showNextExample();
        return;
      }

      // Если мы завершили retry (или не было ошибок) — отправляем финальное событие
      logger.info(CONTEXT, `Phase "${session.retryPhase}" finished.`);
      eventBus.emit?.(EVENTS.TRAINING_FINISH, {
        correct: session.stats.correct,
        total: session.stats.total,
        wrongExamples: session.wrongExamples,
        phase: session.retryPhase
      }) || eventBus.publish?.(EVENTS.TRAINING_FINISH, {
        correct: session.stats.correct,
        total: session.stats.total,
        wrongExamples: session.wrongExamples,
        phase: session.retryPhase
      });

      logger.info(CONTEXT, 'Training finished:', session.stats);
      logger.info(CONTEXT, 'Wrong examples (final):', session.wrongExamples.length);
    }

    // === Sequential playback with color alternation ===
    async function playSequential(steps, intervalMs, { beepOnStep = false } = {}) {
      try {
        for (let i = 0; i < steps.length; i++) {
          if (showAbort) break;

          const s = steps[i];
          const isOdd = (i % 2) === 0;
          const color = isOdd ? "#EC8D00" : "#6db45c";

          overlay.show(formatStep(s), color);
          if (beepOnStep) playSound("tick");
          await delay(intervalMs);
          overlay.hide();
          await delay(UI.DELAY_BETWEEN_STEPS_MS);
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

    // === Event listeners ===
    const listeners = [];

    function addListener(element, event, handler) {
      if (!element) return;
      element.addEventListener(event, handler);
      listeners.push({ element, event, handler });
    }

    addListener(document.getElementById("btn-show-abacus"), "click", () => {
      abacusWrapper.classList.toggle("visible");
      const btn = document.getElementById("btn-show-abacus");
      if (btn) {
        btn.textContent = abacusWrapper.classList.contains("visible")
          ? "🧮 Скрыть абакус"
          : "🧮 Показать абакус";
      }
    });

    addListener(document.getElementById("btn-close-abacus"), "click", () => {
      abacusWrapper.classList.remove("visible");
      const btn = document.getElementById("btn-show-abacus");
      if (btn) btn.textContent = "🧮 Показать абакус";
    });

    addListener(document.getElementById("btn-submit"), "click", checkAnswer);

    addListener(document.getElementById("answer-input"), "keypress", (e) => {
      if (e.key === "Enter") checkAnswer();
    });

    // === Global timer for entire series (оставляю как у тебя) ===
    if (st.timeLimitEnabled && st.timePerExampleMs > 0) {
      startAnswerTimer(st.timePerExampleMs, {
        onExpire: () => {
          logger.warn(CONTEXT, 'Series time expired!');
          finishPhase(); // завершаем текущую фазу
        },
        textElementId: "answerTimerText",
        barSelector: "#answer-timer .bar"
      });
    }

    // === Start ===
    showNextExample();
    logger.info(
      CONTEXT,
      `Trainer started (phase=${session.retryPhase}, ${abacusColumns} columns for ${digits}-digit numbers)`
    );

    // === Cleanup function ===
    return () => {
      const wrapper = document.getElementById("abacus-wrapper");
      if (wrapper) wrapper.remove();
      showAbort = true;
      isShowing = false;
      overlay.clear();
      stopAnswerTimer();

      // Remove all event listeners
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });

      logger.debug(CONTEXT, 'Trainer unmounted, listeners cleaned up');
    };

  } catch (err) {
    showFatalError(err);
  }
}

/** Show fatal error using createElement (secure) */
function showFatalError(err) {
  const msg = err?.stack || err?.message || String(err);
  logger.error(CONTEXT, 'Fatal error:', err);

  const host = document.querySelector(".screen__body") || document.body;

  const errorDiv = document.createElement("div");
  errorDiv.style.cssText = "color:#d93025;padding:16px;white-space:pre-wrap";

  const title = document.createElement("b");
  title.textContent = "Не удалось загрузить тренажёр.";

  const br = document.createElement("br");

  const message = document.createTextNode(msg);

  errorDiv.append(title, br, message);
  host.insertBefore(errorDiv, host.firstChild);
}

/** Get example count */
function getExampleCount(examplesCfg) {
  if (!examplesCfg) return DEFAULTS.EXAMPLES_COUNT;
  return examplesCfg.infinite
    ? DEFAULTS.EXAMPLES_COUNT
    : (examplesCfg.count ?? DEFAULTS.EXAMPLES_COUNT);
}
