// ext/trainer_logic.js — Trainer logic (вариант B: минимальный патч поверх мастера)
// Главная идея: тренажёр больше НЕ показывает свой внутренний экран
// "Итоги сессии", а отдаёт результаты наружу. Глобальный экран "Результаты"
// (скрин 2) теперь единственный финальный экран.
//
// Что изменено по сравнению с твоей текущей версией:
//  - finishTraining() больше НЕ вызывает renderResultsScreen()
//    и НЕ рендерит локальную карточку результатов внутри тренажёра
//  - вместо этого finishTraining() записывает результаты в state.results
//    и настраивает state.retryMode
//  - затем вызывает onBackToSettings?.() как универсальный переход
//    на внешний экран "Результаты" (скрин 2)
//
// Всё остальное (session.mode, reviewQueue, remountTrainerViewForReview,
// renderResultsScreen и т.д.) оставлено нетронутым, чтобы не поломать связи.

import { ExampleView } from "./components/ExampleView.js";
import { Abacus } from "./components/AbacusNew.js";
import { generateExample } from "./core/generator.js";
import { startAnswerTimer, stopAnswerTimer } from "../js/utils/timer.js";
import { BigStepOverlay } from "../ui/components/BigStepOverlay.js";
import { playSound } from "../js/utils/sound.js";
import { logger } from "../core/utils/logger.js";
import { UI, DEFAULTS } from "../core/utils/constants.js";
import { eventBus, EVENTS } from "../core/utils/events.js";
import toast from "../ui/components/Toast.js";
import { state, resetResults } from "../core/state.js";

const CONTEXT = "Trainer";

/**
 * Создание основного layout тренажёра (пример, поле ответа, боковая панель).
 * ВНИМАНИЕ: здесь же есть кнопка "⏹ Выйти".
 */
function createTrainerLayout(displayMode, exampleCount, t) {
  const layout = document.createElement("div");
  layout.className = `mws-trainer mws-trainer--${displayMode}`;

  // ===== MAIN AREA =====
  const trainerMain = document.createElement("div");
  trainerMain.className = `trainer-main trainer-main--${displayMode}`;

  const exampleArea = document.createElement("div");
  exampleArea.id = "area-example";
  exampleArea.className = "example-view";
  trainerMain.appendChild(exampleArea);

  // ===== CONTROLS PANEL =====
  const panelControls = document.createElement("div");
  panelControls.id = "panel-controls";

  // --- Answer section
  const answerSection = document.createElement("div");
  answerSection.className = "answer-section-panel";

  const answerLabel = document.createElement("div");
  answerLabel.className = "answer-label";
  answerLabel.textContent =
    t?.("trainer.answerLabel") || "Ответ:";

  const answerInput = document.createElement("input");
  answerInput.type = "number";
  answerInput.id = "answer-input";
  answerInput.placeholder = "";

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn--primary";
  submitBtn.id = "btn-submit";
  submitBtn.textContent =
    t?.("trainer.submitButton") || "Ответить";

  answerSection.append(answerLabel, answerInput, submitBtn);

  // --- Results capsule (per-session stats)
  const resultsCapsuleExt = createResultsCapsule(exampleCount, t);

  // --- Progress container (progress bars + percents)
  const progressContainer = createProgressContainer(t);

  // --- Timer strip + text
  const timerContainer = document.createElement("div");
  timerContainer.id = "answer-timer";
  const timerBar = document.createElement("div");
  timerBar.className = "bar";
  timerContainer.appendChild(timerBar);

  const timerText = document.createElement("div");
  timerText.id = "answerTimerText";
  timerText.className = "answer-timer__text";

  // --- Abacus toggle
  const panelCard = document.createElement("div");
  panelCard.className = "panel-card panel-card--compact";

  const abacusBtn = document.createElement("button");
  abacusBtn.className = "btn btn--secondary btn--fullwidth";
  abacusBtn.id = "btn-show-abacus";
  abacusBtn.textContent =
    t?.("trainer.showAbacus") || "🧮 Показать абакус";

  panelCard.appendChild(abacusBtn);

  // --- Exit button (контроль немедленного выхода из сессии)
  const exitWrapper = document.createElement("div");
  exitWrapper.className = "panel-card panel-card--compact";

  const exitBtn = document.createElement("button");
  exitBtn.id = "btn-exit-trainer";
  exitBtn.className = "btn btn--secondary btn--fullwidth btn--danger";
  exitBtn.textContent =
    t?.("trainer.exitButton") || "⏹ Выйти";

  exitWrapper.appendChild(exitBtn);

  // add everything to side panel
  panelControls.append(
    answerSection,
    resultsCapsuleExt,
    progressContainer,
    timerContainer,
    timerText,
    panelCard,
    exitWrapper
  );

  layout.append(trainerMain, panelControls);
  return layout;
}

function createResultsCapsule(exampleCount, t) {
  const container = document.createElement("div");
  container.className = "results-capsule-extended";

  const header = document.createElement("div");
  header.className = "results-capsule-extended__header";

  const label = document.createElement("span");
  label.className = "results-capsule-extended__label";
  label.textContent =
    t?.("confirmation.list.actions") || "Примеры:";

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
  correctSide.className =
    "results-capsule__side results-capsule__side--correct";

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
  incorrectSide.className =
    "results-capsule__side results-capsule__side--incorrect";

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

function createProgressContainer(t) {
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
  correctLabel.textContent =
    t?.("trainer.correctLabel") || "Правильно: ";
  const correctPercent = document.createElement("strong");
  correctPercent.id = "percent-correct";
  correctPercent.textContent = "0%";
  correctLabel.appendChild(correctPercent);

  const incorrectLabel = document.createElement("span");
  incorrectLabel.className = "progress-label__incorrect";
  incorrectLabel.textContent =
    t?.("trainer.incorrectLabel") || "Ошибки: ";
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
 * Локальный экран результатов (промежуточный "Итоги сессии") — ТЕПЕРЬ НЕ ИСПОЛЬЗУЕТСЯ.
 * Мы оставляем функцию renderResultsScreen() в файле, чтобы не рушить импорты,
 * но finishTraining() больше НЕ вызывает её.
 *
 * Внешний глобальный экран результатов (скрин 2) станет единственным.
 */
function renderResultsScreen(rootNode, session, { t, onRestart, onRetryErrors, onBackToSettings }) {
  // ⚠️ Эта функция оставлена для обратной совместимости,
  // но не должна вызываться из finishTraining() в новой логике.
  // Мы НЕ удаляем её, чтобы не поломать код, который мог где-то на неё ссылаться.

  rootNode.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "results-screen";

  const titleEl = document.createElement("h2");
  titleEl.className = "results-screen__title";
  titleEl.textContent = t?.("results.title") || "Итоги сессии";

  const descEl = document.createElement("div");
  descEl.className = "results-screen__desc";
  descEl.textContent =
    t?.("results.description") || "Так прошла попытка.";

  const statsEl = document.createElement("div");
  statsEl.className = "results-screen__stats";

  const correctLine = document.createElement("div");
  correctLine.className = "results-screen__row results-screen__row--success";
  const correctLabel = document.createElement("span");
  correctLabel.textContent =
    t?.("results.success") || "Верно";
  const correctValue = document.createElement("strong");
  correctValue.textContent = `${session.stats.correct}/${session.stats.total}`;
  correctLine.append(correctLabel, correctValue);

  const mistakeLine = document.createElement("div");
  mistakeLine.className = "results-screen__row results-screen__row--fail";
  const mistakesLabel = document.createElement("span");
  mistakesLabel.textContent =
    t?.("results.mistakes") || "Ошибки";
  const mistakesValue = document.createElement("strong");
  mistakesValue.textContent = `${session.stats.incorrect}`;
  mistakeLine.append(mistakesLabel, mistakesValue);

  statsEl.append(correctLine, mistakeLine);

  const actionsEl = document.createElement("div");
  actionsEl.className = "results-screen__actions";

  // Кнопка "Исправить ошибки" (в предыдущей логике)
  if (
    session.incorrectExamples &&
    session.incorrectExamples.length > 0 &&
    session.stats.incorrect > 0
  ) {
    const retryBtn = document.createElement("button");
    retryBtn.className = "btn btn--primary";
    retryBtn.id = "btn-retry-errors";
    retryBtn.textContent =
      t?.("results.retryErrors") || "Исправить ошибки";

    retryBtn.addEventListener("click", () => {
      onRetryErrors?.();
    });

    actionsEl.appendChild(retryBtn);
  }

  // Кнопка "Запустить новое задание"
  const backBtn = document.createElement("button");
  backBtn.className = "btn btn--secondary";
  backBtn.id = "btn-results-back";
  backBtn.textContent =
    t?.("results.cta") || "Запустить новое задание";

  backBtn.addEventListener("click", () => {
    onBackToSettings?.();
  });

  actionsEl.appendChild(backBtn);

  wrapper.append(titleEl, descEl, statsEl, actionsEl);
  rootNode.appendChild(wrapper);
}

/**
 * Основная точка входа.
 *
 * @param {HTMLElement} container
 * @param {{
 *   t: Function,
 *   state: { settings: any },
 *   onExitTrainer?: Function,
 *   onBackToSettings?: Function, // <-- теперь это должен быть переход на глобальный экран "Результаты"
 * }} context
 *
 * ВАЖНО ДЛЯ ТЕБЯ:
 *  - onBackToSettings() теперь вызывается в конце тренировки,
 *    чтобы роутер показал ГЛОБАЛЬНЫЙ экран "Результаты".
 *
 *  - Мы больше НЕ рендерим "локальные результаты" здесь.
 */
export function mountTrainerUI(
  container,
  { t, state: stateFromCaller, onExitTrainer, onBackToSettings }
) {
  try {
    logger.info(CONTEXT, "Mounting trainer UI...");
    logger.debug(CONTEXT, "Settings:", stateFromCaller?.settings);

    const st = stateFromCaller?.settings ?? {};
    const actionsCfg = st.actions ?? {};
    const examplesCfg = st.examples ?? {};
    const blockSimpleDigits = Array.isArray(st?.blocks?.simple?.digits)
      ? st.blocks.simple.digits
      : [];

    const digits = parseInt(st.digits, 10) || 1; // выбранная разрядность для примеров
    const abacusColumns = digits + 1; // методически: на одну стойку больше
    const displayMode = st.inline ? "inline" : "column";

    // --- количество примеров в серии (без учёта ретраев)
    const exampleCount = getExampleCount(examplesCfg);

    // === Session state ===
    const session = {
      currentExample: null,

      // статистика основной серии
      stats: { correct: 0, incorrect: 0, total: exampleCount },

      // сколько примеров уже отдали ребёнку в основной фазе
      completed: 0,

      // примеры, где ребёнок ошибся
      // каждый элемент: { steps:[...], answer:number }
      incorrectExamples: [],

      // режим: "main" (основная серия) или "review" (исправление ошибок внутри этой же сессии)
      mode: "main",
      reviewQueue: [],
      reviewIndex: 0
    };

    // === DOM mount тренажёра ===
    const layout = createTrainerLayout(displayMode, exampleCount, t);
    container.innerHTML = "";
    container.appendChild(layout);

    // Abacus overlay
    const oldAbacus = document.getElementById("abacus-wrapper");
    if (oldAbacus) oldAbacus.remove();

    const abacusWrapper = createAbacusWrapper();
    document.body.appendChild(abacusWrapper);

    const exampleView = new ExampleView(
      document.getElementById("area-example")
    );

    const abacus = new Abacus(
      document.getElementById("floating-abacus-container"),
      abacusColumns
    );

    const overlayColor =
      getComputedStyle(document.documentElement).getPropertyValue(
        "--color-primary"
      )?.trim() || "#EC8D00";
    const overlay = new BigStepOverlay(
      st.bigDigitScale ?? UI.BIG_DIGIT_SCALE,
      overlayColor
    );

    const shouldShowAbacus = st.mode === "abacus";
    if (shouldShowAbacus) {
      abacusWrapper.classList.add("visible");
      const btn = document.getElementById("btn-show-abacus");
      if (btn)
        btn.textContent =
          t?.("trainer.hideAbacus") || "🧮 Скрыть абакус";
    }

    let isShowing = false;
    let showAbort = false;

    // -------------------------------------------------
    // Вспомогалки адаптации шрифта
    // -------------------------------------------------
    function adaptExampleFontSize(actionsCount, maxDigitsInOneStep) {
      const exampleLines = document.querySelectorAll(
        "#area-example .example__line"
      );
      if (!exampleLines.length) return;

      const actionsFactor = Math.min(actionsCount, 12) / 12;
      const digitsFactor = Math.min(maxDigitsInOneStep, 9) / 9;
      const complexityFactor = (actionsFactor + digitsFactor) / 2;

      const minFontSize = 24;
      const maxFontSize = 96;
      const fontSize =
        maxFontSize -
        complexityFactor * (maxFontSize - minFontSize);

      exampleLines.forEach((line) => {
        line.style.setProperty(
          "font-size",
          `${Math.round(fontSize)}px`,
          "important"
        );
        line.style.setProperty("line-height", "1.2", "important");
      });
    }

    // -------------------------------------------------
    // Генератор параметров примера
    // -------------------------------------------------
    function buildGeneratorSettings() {
      const selectedDigits =
        blockSimpleDigits.length > 0
          ? blockSimpleDigits.map((d) => parseInt(d, 10))
          : [1, 2, 3, 4];

      const genMin =
        actionsCfg.infinite === true
          ? DEFAULTS.ACTIONS_MIN
          : (actionsCfg.min ??
             actionsCfg.count ??
             DEFAULTS.ACTIONS_MIN);

      const genMax =
        actionsCfg.infinite === true
          ? DEFAULTS.ACTIONS_MAX
          : (actionsCfg.max ??
             actionsCfg.count ??
             DEFAULTS.ACTIONS_MAX);

      return {
        blocks: {
          simple: {
            digits: selectedDigits,
            includeFive:
              (st.blocks?.simple?.includeFive ??
                selectedDigits.includes(5)),
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
          min: genMin,
          max: genMax,
          count: actionsCfg.count,
          infinite: actionsCfg.infinite === true
        },

        digits: st.digits,
        combineLevels: st.combineLevels || false
      };
    }

    // -------------------------------------------------
    // Сборка + показ нового примера (main или review)
    // -------------------------------------------------
    function createAndShowExample() {
      let generated;

      if (session.mode === "review") {
        // берём следующий пример из очереди исправлений
        if (session.reviewIndex >= session.reviewQueue.length) {
          // мы закончили режим review -> полное завершение
          finishTraining();
          return null;
        }
        generated = session.reviewQueue[session.reviewIndex];
      } else {
        generated = generateExample(buildGeneratorSettings());
      }

      session.currentExample = generated;

      // для адаптации шрифта
      const actionsLen = generated.steps.length;
      let maxDigitsInStep = 1;
      for (const step of generated.steps) {
        const numericPart = String(step).replace(/[^\d-]/g, "");
        const num = parseInt(numericPart, 10);
        if (!isNaN(num)) {
          const lenAbs = Math.abs(num).toString().length;
          if (lenAbs > maxDigitsInStep) {
            maxDigitsInStep = lenAbs;
          }
        }
      }

      // очистка ответа
      const input = document.getElementById("answer-input");
      if (input) input.value = "";

      // режим диктовки
      const shouldUseDictation = actionsLen > 12;
      const effectiveShowSpeed = shouldUseDictation
        ? 2000
        : (st.showSpeedMs || 0);
      const showSpeedActive =
        st.showSpeedEnabled && effectiveShowSpeed > 0;

      if (showSpeedActive || shouldUseDictation) {
        exampleView.clear();
      } else {
        exampleView.render(
          generated.steps,
          displayMode
        );
        requestAnimationFrame(() => {
          adaptExampleFontSize(actionsLen, maxDigitsInStep);
        });
      }

      const lockDuringShow = st.lockInputDuringShow !== false;
      if (input) input.disabled = lockDuringShow;

      if (showSpeedActive || shouldUseDictation) {
        isShowing = true;
        showAbort = false;
        playSequential(
          generated.steps,
          effectiveShowSpeed,
          { beepOnStep: !!st.beepOnStep }
        ).then(async () => {
          if (showAbort) return;
          await delay(
            st.showSpeedPauseAfterChainMs ??
              UI.PAUSE_AFTER_CHAIN_MS
          );
          isShowing = false;

          if (lockDuringShow && input) {
            input.disabled = false;
            input.focus();
          }
        });
      } else {
        if (input) {
          input.disabled = false;
          input.focus();
        }
      }

      logger.debug(
        CONTEXT,
        "New example:",
        generated.steps,
        "Answer:",
        generated.answer,
        "mode:",
        session.mode
      );

      return generated;
    }

    /**
     * Показ следующего примера.
     * Если серия основной тренировки закончилась → finishTraining().
     */
    function showNextExample() {
      overlay.clear();
      showAbort = true;
      isShowing = false;

      // Основная фаза закончилась?
      if (
        session.mode === "main" &&
        session.completed >= session.stats.total
      ) {
        finishTraining();
        return;
      }

      createAndShowExample();
    }

    /**
     * Пользователь даёт ответ.
     */
    function checkAnswer() {
      const input = document.getElementById("answer-input");

      if (isShowing && (st.lockInputDuringShow !== false)) return;

      const userAnswer = parseInt(input?.value ?? "", 10);
      if (isNaN(userAnswer)) {
        toast.warning(
          t?.("trainer.pleaseEnterNumber") ||
            "Пожалуйста, введите число"
        );
        return;
      }

      if (isShowing && (st.lockInputDuringShow === false)) {
        showAbort = true;
        isShowing = false;
        overlay.clear();
      }

      const isCorrect =
        userAnswer === session.currentExample.answer;

      if (session.mode === "main") {
        if (isCorrect) {
          session.stats.correct++;
        } else {
          session.stats.incorrect++;
          session.incorrectExamples.push({
            steps: [...session.currentExample.steps],
            answer: session.currentExample.answer,
            userAnswer
          });
        }
        session.completed++;
      } else if (session.mode === "review") {
        // в режиме review мы не меняем основную статистику,
        // просто двигаем очередь
        if (!isCorrect) {
          // если снова неправильно — можно закинуть обратно в хвост
          session.reviewQueue.push({
            steps: [...session.currentExample.steps],
            answer: session.currentExample.answer,
            userAnswer
          });
        }
        session.reviewIndex++;
      }

      updateStatsUI();
      playSound(isCorrect ? "correct" : "wrong");

      setTimeout(
        () => showNextExample(),
        UI.TRANSITION_DELAY_MS
      );
    }

    /**
     * Истечение таймера отдельного примера
     */
    function handleTimeExpired() {
      const correct = session.currentExample?.answer;
      logger.warn(
        CONTEXT,
        "Time expired! Correct answer:",
        correct
      );

      if (st.beepOnTimeout) playSound("wrong");

      if (session.mode === "main") {
        session.stats.incorrect++;
        session.incorrectExamples.push({
          steps: [...session.currentExample.steps],
          answer: session.currentExample.answer,
          userAnswer: null
        });
        session.completed++;
      } else if (session.mode === "review") {
        session.reviewIndex++;
      }

      updateStatsUI();
      setTimeout(
        () => showNextExample(),
        UI.TIMEOUT_DELAY_MS
      );
    }

    /**
     * Обновление правой панели статистики
     */
    function updateStatsUI() {
      const { correct, incorrect, total } = session.stats;
      const completed = session.completed;
      const el = (id) => document.getElementById(id);

      el("stats-completed") &&
        (el("stats-completed").textContent =
          String(completed));
      el("stats-correct") &&
        (el("stats-correct").textContent =
          String(correct));
      el("stats-incorrect") &&
        (el("stats-incorrect").textContent =
          String(incorrect));

      const percentCorrect =
        completed > 0
          ? Math.round((correct / completed) * 100)
          : 0;
      const percentIncorrect =
        completed > 0
          ? Math.round((incorrect / completed) * 100)
          : 0;

      el("progress-correct") &&
        (el("progress-correct").style.width =
          percentCorrect + "%");
      el("progress-incorrect") &&
        (el("progress-incorrect").style.width =
          percentIncorrect + "%");
      el("percent-correct") &&
        (el("percent-correct").textContent =
          percentCorrect + "%");
      el("percent-incorrect") &&
        (el("percent-incorrect").textContent =
          percentIncorrect + "%");
    }

    /**
     * ВАЖНО: ключевая точка.
     *
     * finishTraining() БОЛЬШЕ НЕ рендерит локальный экран результатов
     * через renderResultsScreen(). Вместо этого:
     *
     * - останавливает таймеры и чистит overlay
     * - записывает данные сессии в глобальный state.results
     * - готовит state.retryMode (для "Исправить ошибки")
     * - вызывает onBackToSettings() как сигнал роутеру:
     *   "покажи внешний экран Результаты" (скрин 2)
     *
     * Это убирает двойной экран результатов.
     */
    function finishTraining() {
      stopAnswerTimer();
      showAbort = true;
      isShowing = false;
      overlay.clear();
      abacusWrapper.classList.remove("visible");

      logger.info(
        CONTEXT,
        "Training finished:",
        session.stats,
        "mode:",
        session.mode,
        "incorrectExamples:",
        session.incorrectExamples
      );

      // Готовим данные для внешнего экрана "Результаты"
      state.results = {
        total: session.stats.total,
        success: session.stats.correct,
        wrongExamples: session.incorrectExamples.slice()
      };

      // Настраиваем retryMode:
      // "Исправить ошибки" нажимается уже на внешнем экране результатов,
      // поэтому мы сюда сохраняем очередь.
      state.retryMode = {
        enabled: session.incorrectExamples.length > 0,
        examples: session.incorrectExamples.slice()
      };

      // Сохраним настройки, чтобы потом можно было перезапустить
      // или запустить retry с теми же параметрами генератора
      state.lastSettings = st;

      // Переходим наружу.
      // onBackToSettings() теперь обязан показать глобальный экран результатов,
      // а не буквально "настройки".
      onBackToSettings?.();

      // Дополнительно эмитим TRAINING_FINISH для тех частей приложения,
      // которые на него уже подписаны.
      eventBus.emit?.(EVENTS.TRAINING_FINISH, {
        correct: session.stats.correct,
        total: session.stats.total,
        wrong: session.stats.incorrect,
        phase: "done",
        wrongExamples: session.incorrectExamples.slice()
      }) ||
        eventBus.publish?.(EVENTS.TRAINING_FINISH, {
          correct: session.stats.correct,
          total: session.stats.total,
          wrong: session.stats.incorrect,
          phase: "done",
          wrongExamples: session.incorrectExamples.slice()
        });
    }

    /**
     * Пере-маунт тренажёра для режима review (ИСПРАВИТЬ ОШИБКИ)
     * Эта логика остаётся здесь для обратной совместимости,
     * но в новой архитектуре запуск ретрая делается С СНАРУЖИ (из экрана "Результаты"),
     * и туда мы просто создаём новый mountTrainerUI с state.retryMode.enabled = true.
     *
     * remountTrainerViewForReview() сейчас не вызывается из finishTraining().
     */
    function remountTrainerViewForReview() {
      session.mode = "review";
      session.reviewQueue = session.incorrectExamples.map(e => ({
        steps: [...e.steps],
        answer: e.answer
      }));
      session.reviewIndex = 0;

      const newLayout = createTrainerLayout(
        displayMode,
        session.reviewQueue.length,
        t
      );
      container.innerHTML = "";
      container.appendChild(newLayout);

      rebindDynamicRefsAfterRemount();
      showNextExample();
    }

    /**
     * После remount-а (исторически для режима review)
     */
    function rebindDynamicRefsAfterRemount() {
      attachListeners(); // перевешиваем события
      updateStatsUI();

      const btnToggleAbacus = document.getElementById("btn-show-abacus");
      if (btnToggleAbacus) {
        btnToggleAbacus.textContent = abacusWrapper.classList.contains("visible")
          ? (t?.("trainer.hideAbacus") || "🧮 Скрыть абакус")
          : (t?.("trainer.showAbacus") || "🧮 Показать абакус");
      }
    }

    /**
     * Последовательный показ шагов с overlay
     */
    async function playSequential(
      steps,
      intervalMs,
      { beepOnStep = false } = {}
    ) {
      try {
        for (let i = 0; i < steps.length; i++) {
          if (showAbort) break;

          const stepStr = formatStep(steps[i]);
          const isOdd = i % 2 === 0;
          const color = isOdd ? "#EC8D00" : "#6db45c";

          overlay.show(stepStr, color);
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
      return String(step);
    }

    function delay(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    // === Слушатели ===
    const listeners = [];

    function addListener(element, event, handler) {
      if (!element) return;
      element.addEventListener(event, handler);
      listeners.push({ element, event, handler });
    }

    function attachListeners() {
      addListener(
        document.getElementById("btn-show-abacus"),
        "click",
        () => {
          abacusWrapper.classList.toggle("visible");
          const btn = document.getElementById("btn-show-abacus");
          if (btn) {
            btn.textContent = abacusWrapper.classList.contains(
              "visible"
            )
              ? (t?.("trainer.hideAbacus") || "🧮 Скрыть абакус")
              : (t?.("trainer.showAbacus") || "🧮 Показать абакус");
          }
        }
      );

      addListener(
        document.getElementById("btn-close-abacus"),
        "click",
        () => {
          abacusWrapper.classList.remove("visible");
          const btn = document.getElementById("btn-show-abacus");
          if (btn)
            btn.textContent =
              t?.("trainer.showAbacus") ||
              "🧮 Показать абакус";
        }
      );

      addListener(
        document.getElementById("btn-submit"),
        "click",
        checkAnswer
      );

      addListener(
        document.getElementById("answer-input"),
        "keypress",
        (e) => {
          if (e.key === "Enter") checkAnswer();
        }
      );

      // Exit trainer button
      addListener(
        document.getElementById("btn-exit-trainer"),
        "click",
        () => {
          // Немедленный выход по кнопке.
          // Это считается "прерванной сессией": мы не дописываем статистику
          // в state.results целиком, потому что она неполная.
          stopAnswerTimer();
          showAbort = true;
          isShowing = false;
          overlay.clear();
          abacusWrapper.classList.remove("visible");

          // Глобальному состоянию — сброс результатов,
          // чтобы экран результатов не показывал случайные старые данные.
          resetResults();
          state.retryMode = {
            enabled: false,
            examples: []
          };

          onExitTrainer?.();
          onBackToSettings?.();

          eventBus.emit?.(EVENTS.TRAINING_FINISH, {
            correct: session.stats.correct,
            total: session.stats.total,
            phase: "exit"
          }) ||
            eventBus.publish?.(EVENTS.TRAINING_FINISH, {
              correct: session.stats.correct,
              total: session.stats.total,
              phase: "exit"
            });
        }
      );
    }

    attachListeners();

    // === Глобальный таймер на всю серию (если включён)
    if (st.timeLimitEnabled && st.timePerExampleMs > 0) {
      startAnswerTimer(st.timePerExampleMs, {
        onExpire: () => {
          logger.warn(
            CONTEXT,
            "Series time expired!"
          );
          finishTraining();
        },
        textElementId: "answerTimerText",
        barSelector: "#answer-timer .bar"
      });
    }

    // === Таймер на один пример (если включён)
    if (st.perExampleTimerEnabled && st.perExampleTimeMs > 0) {
      startAnswerTimer(st.perExampleTimeMs, {
        onExpire: () => handleTimeExpired(),
        textElementId: "answerTimerText",
        barSelector: "#answer-timer .bar"
      });
    }

    // === Старт основной сессии
    showNextExample();
    logger.info(
      CONTEXT,
      `Trainer started (${abacusColumns} columns for ${digits}-digit numbers)`
    );

    // === Cleanup
    return () => {
      const wrapper = document.getElementById("abacus-wrapper");
      if (wrapper) wrapper.remove();
      showAbort = true;
      isShowing = false;
      overlay.clear();
      stopAnswerTimer();

      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });

      logger.debug(
        CONTEXT,
        "Trainer unmounted, listeners cleaned up"
      );
    };
  } catch (err) {
    showFatalError(err);
  }
}

/** Падение тренера с ошибкой */
function showFatalError(err) {
  const msg = err?.stack || err?.message || String(err);
  logger.error(CONTEXT, "Fatal error:", err);

  const host =
    document.querySelector(".screen__body") || document.body;

  const errorDiv = document.createElement("div");
  errorDiv.style.cssText =
    "color:#d93025;padding:16px;white-space:pre-wrap";

  const title = document.createElement("b");
  title.textContent = "Не удалось загрузить тренажёр.";

  const br = document.createElement("br");

  const message = document.createTextNode(msg);

  errorDiv.append(title, br, message);
  host.insertBefore(errorDiv, host.firstChild);
}

/** Количество примеров в основной серии */
function getExampleCount(examplesCfg) {
  if (!examplesCfg) return DEFAULTS.EXAMPLES_COUNT;
  return examplesCfg.infinite
    ? DEFAULTS.EXAMPLES_COUNT
    : (examplesCfg.count ?? DEFAULTS.EXAMPLES_COUNT);
}
