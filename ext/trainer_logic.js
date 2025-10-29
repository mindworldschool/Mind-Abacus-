// ext/trainer_logic.js — Trainer logic (серия + исправление ошибок + выход)

import { ExampleView } from "./components/ExampleView.js";
import { Abacus } from "./components/AbacusNew.js";
import { generateExample } from "./core/generator.js";
import { startAnswerTimer, stopAnswerTimer } from "../js/utils/timer.js";
import { BigStepOverlay } from "../ui/components/BigStepOverlay.js";
import { playSound } from "../js/utils/sound.js";
import { logger } from "../core/utils/logger.js";
import { UI, FONT_SIZE, DEFAULTS } from "../core/utils/constants.js";
import { eventBus, EVENTS } from "../core/utils/events.js";
import toast from "../ui/components/Toast.js";

const CONTEXT = "Trainer";

/**
 * Build panel + example area
 */
function createTrainerLayout(displayMode, exampleCount, t) {
  const layout = document.createElement("div");
  layout.className = `mws-trainer mws-trainer--${displayMode}`;

  // MAIN (пример)
  const trainerMain = document.createElement("div");
  trainerMain.className = `trainer-main trainer-main--${displayMode}`;

  const exampleArea = document.createElement("div");
  exampleArea.id = "area-example";
  exampleArea.className = "example-view";
  trainerMain.appendChild(exampleArea);

  // SIDE PANEL
  const panelControls = document.createElement("div");
  panelControls.id = "panel-controls";

  // --- Ответ ---
  const answerSection = document.createElement("div");
  answerSection.className = "answer-section-panel";

  const answerLabel = document.createElement("div");
  answerLabel.className = "answer-label";
  answerLabel.textContent = t?.("trainer.answerLabel") || "Ответ:";

  const answerInput = document.createElement("input");
  answerInput.type = "number";
  answerInput.id = "answer-input";
  answerInput.placeholder = "";

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn--primary";
  submitBtn.id = "btn-submit";
  submitBtn.textContent =
    t?.("trainer.submitAnswer") || "Ответить";

  answerSection.append(answerLabel, answerInput, submitBtn);

  // --- Капсула результатов внутри тренировки ---
  const resultsCapsuleExt = createResultsCapsule(
    exampleCount,
    t
  );

  // --- Прогресс-бар ---
  const progressContainer = createProgressContainer(t);

  // --- Таймер ---
  const timerContainer = document.createElement("div");
  timerContainer.id = "answer-timer";
  const timerBar = document.createElement("div");
  timerBar.className = "bar";
  timerContainer.appendChild(timerBar);

  const timerText = document.createElement("div");
  timerText.id = "answerTimerText";
  timerText.className = "answer-timer__text";

  // --- Панель с абакусом + выход ---
  const panelCard = document.createElement("div");
  panelCard.className = "panel-card panel-card--compact";

  const abacusBtn = document.createElement("button");
  abacusBtn.className = "btn btn--secondary btn--fullwidth";
  abacusBtn.id = "btn-show-abacus";
  abacusBtn.textContent =
    t?.("trainer.showAbacus") || "🧮 Показать абакус";

  // Новая кнопка "Выход"
  const exitBtn = document.createElement("button");
  exitBtn.className = "btn btn--secondary btn--fullwidth";
  exitBtn.id = "btn-exit-training";
  exitBtn.style.marginTop = "8px";
  exitBtn.textContent =
    t?.("trainer.exitButton") || "⏹ Выйти";

  panelCard.appendChild(abacusBtn);
  panelCard.appendChild(exitBtn);

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

/**
 * Рендер капсулы с прогрессом серии
 */
function createResultsCapsule(exampleCount, t) {
  const container = document.createElement("div");
  container.className = "results-capsule-extended";

  const header = document.createElement("div");
  header.className = "results-capsule-extended__header";

  const label = document.createElement("span");
  label.className = "results-capsule-extended__label";
  label.textContent =
    t?.("stats.examples") || "Примеры:";

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

/**
 * Полоска прогресса + подписи
 */
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
    (t?.("stats.correct") || "Правильно: ") + " ";
  const correctPercent = document.createElement("strong");
  correctPercent.id = "percent-correct";
  correctPercent.textContent = "0%";
  correctLabel.appendChild(correctPercent);

  const incorrectLabel = document.createElement("span");
  incorrectLabel.className = "progress-label__incorrect";
  incorrectLabel.textContent =
    (t?.("stats.wrong") || "Ошибки: ") + " ";
  const incorrectPercent = document.createElement("strong");
  incorrectPercent.id = "percent-incorrect";
  incorrectPercent.textContent = "0%";
  incorrectLabel.appendChild(incorrectPercent);

  labels.append(correctLabel, incorrectLabel);
  container.append(progressBar, labels);
  return container;
}

/**
 * Абакус контейнер (плавающий мини-абакус)
 */
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
 * Основная функция монтирования шага "Тренировка"
 *
 * @param {HTMLElement} container - куда рендерим тренажёр
 * @param {Object} context - { t, state }
 * @returns {Function} cleanup
 */
export function mountTrainerUI(container, { t, state }) {
  try {
    logger.info(CONTEXT, "Mounting trainer UI...");
    logger.debug(CONTEXT, "Settings:", state?.settings);

    const st = state?.settings ?? {};

    // Настройки из state
    const actionsCfg = st.actions ?? {};
    const examplesCfg = st.examples ?? {};
    const blockSimpleDigits = Array.isArray(
      st?.blocks?.simple?.digits
    )
      ? st.blocks.simple.digits
      : [];

    const digits = parseInt(st.digits, 10) || 1; // разрядность
    const abacusColumns = digits + 1; // методически +1 стойка
    const displayMode = st.inline ? "inline" : "column";

    // Сколько примеров в серии (без режима "повтори ошибку")
    const exampleCount = getExampleCount(examplesCfg);

    // === Layout ===
    const layout = createTrainerLayout(
      displayMode,
      exampleCount,
      t
    );
    container.appendChild(layout);

    // === Abacus floating panel ===
    const oldAbacus = document.getElementById("abacus-wrapper");
    if (oldAbacus) oldAbacus.remove();

    const abacusWrapper = createAbacusWrapper();
    document.body.appendChild(abacusWrapper);

    const exampleView = new ExampleView(
      document.getElementById("area-example")
    );

    // абакус (столбцов = digits+1)
    const abacus = new Abacus(
      document.getElementById("floating-abacus-container"),
      abacusColumns
    );

    // крупный "бипер шагов"
    const overlayColor =
      getComputedStyle(
        document.documentElement
      ).getPropertyValue("--color-primary")?.trim() ||
      "#EC8D00";
    const overlay = new BigStepOverlay(
      st.bigDigitScale ?? UI.BIG_DIGIT_SCALE,
      overlayColor
    );

    // показать абакус сразу, если режим abacus
    const shouldShowAbacus = st.mode === "abacus";
    if (shouldShowAbacus) {
      abacusWrapper.classList.add("visible");
      const btn = document.getElementById("btn-show-abacus");
      if (btn) {
        btn.textContent =
          t?.("trainer.hideAbacus") ||
          "🧮 Скрыть абакус";
      }
    }

    // === SESSION STATE (одна тренировка) ===
    const session = {
      // текущий пример, который сейчас на экране
      currentExample: null,

      // статистика
      stats: {
        correct: 0,
        incorrect: 0,
        total: exampleCount
      },
      completed: 0,

      // массив ошибок:
      // {
      //   steps: ["+3","+1","-4",...],
      //   answer: 2,
      //   userAnswer: 5
      // }
      mistakes: [],

      // если мы сейчас в режиме "исправляем ошибки"
      correctingMode: false,
      correctionQueue: []
    };

    // служебки показа
    let isShowing = false; // сейчас идёт диктовка шагов?
    let showAbort = false; // флаг прерывания диктовки

    /**
     * Адаптивно уменьшаем/увеличиваем шрифт примера
     */
    function adaptExampleFontSize(actionsCount, maxDigits) {
      const exampleLines = document.querySelectorAll(
        "#area-example .example__line"
      );

      logger.debug(
        CONTEXT,
        `adaptExampleFontSize called: ${exampleLines.length} lines found, actions: ${actionsCount}, digits: ${maxDigits}`
      );

      if (!exampleLines.length) return;

      const actionsFactor = Math.min(actionsCount, 12) / 12; // 0..1
      const digitsFactor = Math.min(maxDigits, 9) / 9; // 0..1
      const complexityFactor =
        (actionsFactor + digitsFactor) / 2;

      const minFontSize = FONT_SIZE.MIN || 24;
      const maxFontSize = FONT_SIZE.MAX || 96;

      const fontSize =
        maxFontSize -
        complexityFactor *
          (maxFontSize - minFontSize);

      exampleLines.forEach((line) => {
        line.style.setProperty(
          "font-size",
          `${Math.round(fontSize)}px`,
          "important"
        );
        line.style.setProperty(
          "line-height",
          "1.2",
          "important"
        );
      });

      logger.debug(
        CONTEXT,
        `Font size: ${Math.round(
          fontSize
        )}px (actions: ${actionsCount}, digits: ${maxDigits})`
      );
    }

    /**
     * Основная функция: показать следующий пример.
     * В обычном режиме -> новый сгенерированный.
     * В режиме исправления -> берём следующий из correctionQueue.
     */
    async function showNextExample() {
      try {
        overlay.clear();
        showAbort = true;
        isShowing = false;

        // Проверка: серия закончена?
        if (
          !session.correctingMode && // обычная серия
          session.completed >= session.stats.total
        ) {
          return finishTraining();
        }

        // В режиме исправления: берём из очереди неправильных
        if (
          session.correctingMode &&
          session.correctionQueue.length === 0
        ) {
          // всё исправлено → завершаем
          return finishTraining();
        }

        // формируем настройки генератора
        const selectedDigits =
          blockSimpleDigits.length > 0
            ? blockSimpleDigits.map((d) =>
                parseInt(d, 10)
              )
            : [1, 2, 3, 4];

        // actions для генератора
        const genMin =
          actionsCfg.infinite === true
            ? DEFAULTS.ACTIONS_MIN
            : actionsCfg.min ??
              actionsCfg.count ??
              DEFAULTS.ACTIONS_MIN;

        const genMax =
          actionsCfg.infinite === true
            ? DEFAULTS.ACTIONS_MAX
            : actionsCfg.max ??
              actionsCfg.count ??
              DEFAULTS.ACTIONS_MAX;

        const generatorSettings = {
          blocks: {
            simple: {
              digits: selectedDigits,
              includeFive:
                st.blocks?.simple?.includeFive ??
                selectedDigits.includes(5),
              onlyAddition:
                st.blocks?.simple?.onlyAddition ??
                false,
              onlySubtraction:
                st.blocks?.simple
                  ?.onlySubtraction ?? false
            },
            brothers: {
              active:
                st.blocks?.brothers?.active ?? false
            },
            friends: {
              active:
                st.blocks?.friends?.active ?? false
            },
            mix: {
              active:
                st.blocks?.mix?.active ?? false
            }
          },

          actions: {
            min: genMin,
            max: genMax,
            count: actionsCfg.count,
            infinite:
              actionsCfg.infinite === true
          },

          // разрядность
          digits: st.digits,

          // "комбинировать уровни"
          combineLevels:
            st.combineLevels || false
        };

        // Если мы сейчас исправляем ошибки —
        // берём готовый пример из очереди, не генерим заново.
        if (session.correctingMode) {
          session.currentExample =
            session.correctionQueue.shift();
        } else {
          // Обычный режим — генерим свежий пример
          session.currentExample =
            generateExample(generatorSettings);
        }

        if (
          !session.currentExample ||
          !Array.isArray(
            session.currentExample.steps
          )
        ) {
          throw new Error(
            "Empty example generated"
          );
        }

        // Анализируем шаги — надо для адаптации размера
        const actionsLen =
          session.currentExample.steps.length;
        let maxDigitsInStep = 1;
        for (const step of session.currentExample
          .steps) {
          const numericPart = String(step).replace(
            /[^\d-]/g,
            ""
          );
          const num = parseInt(numericPart, 10);
          if (!isNaN(num)) {
            const lenAbs = Math.abs(num)
              .toString()
              .length;
            if (lenAbs > maxDigitsInStep) {
              maxDigitsInStep = lenAbs;
            }
          }
        }

        // Очистить поле ввода
        const input =
          document.getElementById(
            "answer-input"
          );
        if (input) input.value = "";

        // Решаем: показывать по одному шагу с анимацией,
        // или сразу весь пример
        const shouldUseDictation =
          actionsLen > 12;
        const effectiveShowSpeed =
          shouldUseDictation
            ? 2000
            : st.showSpeedMs || 0;

        const showSpeedActive =
          st.showSpeedEnabled &&
          effectiveShowSpeed > 0;

        // Если есть анимация, сначала чистим поле примера
        if (showSpeedActive || shouldUseDictation) {
          exampleView.clear();
        } else {
          // Иначе просто сразу рендерим массив шагов
          exampleView.render(
            session.currentExample.steps,
            displayMode
          );
          requestAnimationFrame(() => {
            adaptExampleFontSize(
              actionsLen,
              maxDigitsInStep
            );
          });
        }

        // Блокируем ввод пока показываем пример?
        const lockDuringShow =
          st.lockInputDuringShow !== false;
        if (input) input.disabled = lockDuringShow;

        // Показ по одному шагу с бипом
        if (showSpeedActive || shouldUseDictation) {
          isShowing = true;
          showAbort = false;
          await playSequential(
            session.currentExample.steps,
            effectiveShowSpeed,
            {
              beepOnStep: !!st.beepOnStep
            }
          );
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
        } else {
          if (input) {
            input.disabled = false;
            input.focus();
          }
        }

        logger.debug(
          CONTEXT,
          "New example:",
          session.currentExample.steps,
          "Answer:",
          session.currentExample.answer,
          "correctingMode=",
          session.correctingMode
        );
      } catch (e) {
        showFatalError(e);
      }
    }

    /**
     * Проверка введённого ответа
     */
    function checkAnswer() {
      const input = document.getElementById(
        "answer-input"
      );

      // если идёт показ по шагам и ввод заблокирован
      if (
        isShowing &&
        st.lockInputDuringShow !== false
      )
        return;

      const userAnswer = parseInt(
        input?.value ?? "",
        10
      );
      if (isNaN(userAnswer)) {
        toast.warning(
          t?.("trainer.enterNumberWarn") ||
            "Пожалуйста, введите число"
        );
        return;
      }

      // Если нажали "Ответить" во время анимации —
      // прерываем показ шагов
      if (
        isShowing &&
        st.lockInputDuringShow === false
      ) {
        showAbort = true;
        isShowing = false;
        overlay.clear();
      }

      const correctAnswer =
        session.currentExample.answer;
      const isCorrect =
        userAnswer === correctAnswer;

      if (isCorrect) {
        session.stats.correct++;
        playSound("correct");
      } else {
        session.stats.incorrect++;
        playSound("wrong");

        // Сохраняем ошибку только если мы
        // НЕ находимся уже в режиме исправления.
        if (!session.correctingMode) {
          session.mistakes.push({
            steps:
              session.currentExample.steps.slice(),
            answer: correctAnswer,
            userAnswer: userAnswer
          });
        }
      }

      // Увеличиваем "сколько уже сделали"
      session.completed++;

      updateStats();

      // Следующий пример
      setTimeout(
        () => showNextExample(),
        UI.TRANSITION_DELAY_MS
      );
    }

    /**
     * Таймер отдельного примера (если включён)
     * когда ВРЕМЯ вышло — считаем как ошибку
     */
    function handleTimeExpired() {
      const correct =
        session.currentExample?.answer;
      logger.warn(
        CONTEXT,
        "Time expired! Correct answer:",
        correct
      );

      if (st.beepOnTimeout) playSound("wrong");

      session.stats.incorrect++;
      // сохраняем как ошибку (если не коррежим)
      if (!session.correctingMode) {
        session.mistakes.push({
          steps:
            session.currentExample?.steps?.slice?.() ||
            [],
          answer: correct,
          userAnswer: null // нет ответа
        });
      }

      session.completed++;

      updateStats();
      setTimeout(
        () => showNextExample(),
        UI.TIMEOUT_DELAY_MS
      );
    }

    /**
     * Обновление короткой статистики в правой панели
     */
    function updateStats() {
      const {
        correct,
        incorrect,
        total
      } = session.stats;
      const completed = session.completed;
      const el = (id) =>
        document.getElementById(id);

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
          ? Math.round(
              (correct / completed) * 100
            )
          : 0;
      const percentIncorrect =
        completed > 0
          ? Math.round(
              (incorrect / completed) * 100
            )
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
     * Завершение тренировки:
     *  - останавливаем таймер
     *  - очищаем overlay
     *  - прячем абакус
     *  - показываем кнопку "Исправить ошибки" на экране результатов (шаг 4)
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
        "mistakes:",
        session.mistakes
      );

      // Готовим очередь на исправление (копию),
      // но только когда закончили основную серию.
      if (!session.correctingMode) {
        session.correctionQueue =
          session.mistakes.map((m) => ({
            steps: m.steps,
            answer: m.answer
          }));
      }

      // сообщаем "я закончил" наружу
      eventBus.emit?.(EVENTS.TRAINING_FINISH, {
        correct: session.stats.correct,
        total: session.stats.total,
        phase: session.correctingMode
          ? "correction-done"
          : "done",
        mistakes: session.mistakes.length
      }) ||
        eventBus.publish?.(
          EVENTS.TRAINING_FINISH,
          {
            correct: session.stats
              .correct,
            total: session.stats.total,
            phase: session.correctingMode
              ? "correction-done"
              : "done",
            mistakes:
              session.mistakes.length
          }
        );

      // после эвента UI должен показать экран результатов
      // и мы там дорисуем кнопку "Исправить ошибки"
      goToResultsScreen();
    }

    /**
     * Последовательный показ шагов на оверлее
     * (для диктовки/скорости)
     */
    async function playSequential(
      steps,
      intervalMs,
      { beepOnStep = false } = {}
    ) {
      try {
        for (
          let i = 0;
          i < steps.length;
          i++
        ) {
          if (showAbort) break;

          const stepStr = formatStep(steps[i]);
          const isOdd = i % 2 === 0;
          const color = isOdd
            ? "#EC8D00"
            : "#6db45c";

          overlay.show(stepStr, color);
          if (beepOnStep) playSound("tick");
          await delay(intervalMs);
          overlay.hide();
          await delay(
            UI.DELAY_BETWEEN_STEPS_MS
          );
        }
      } finally {
        overlay.clear();
      }
    }

    // шаги уже приходят "+3", "-7", "+5"
    function formatStep(step) {
      return String(step);
    }

    function delay(ms) {
      return new Promise((r) => setTimeout(r, ms));
    }

    /**
     * Кнопка "Исправить ошибки" на экране Результаты.
     * Мы ждём, что host (экран 4) уже в DOM.
     * Вставляем кнопку слева от "Начать новые настройки",
     * но только если есть ошибки.
     */
    function goToResultsScreen() {
      queueMicrotask(() => {
        // ищем контейнер шага "Результаты"
        const resultsStep =
          document.querySelector(
            ".screen--results, .results-screen, .step-results"
          ) || document.body;

        // ищем кнопку "Начать новые настройки" / "Почати нове налаштування"
        // она уже есть в разметке шага 4
        const restartBtn = Array.from(
          resultsStep.querySelectorAll(
            "button, a"
          )
        ).find((el) => {
          const tx =
            el.textContent
              ?.trim()
              .toLowerCase() || "";
          const cmp =
            (
              t?.("results.startNew") ||
              "Почати нове налаштування"
            )
              .toLowerCase()
              .trim();
          return tx === cmp;
        });

        // создаём "Исправить ошибки (N)", только если есть ошибки
        if (
          restartBtn &&
          session.mistakes.length > 0
        ) {
          // если кнопка ещё не отрисована (чтобы не дублировать)
          if (
            !resultsStep.querySelector(
              "#btn-fix-mistakes-screen"
            )
          ) {
            const fixBtn =
              document.createElement(
                "button"
              );
            fixBtn.id =
              "btn-fix-mistakes-screen";
            fixBtn.className =
              "btn btn--primary";
            fixBtn.style.marginRight =
              "8px";

            const baseFixText =
              t?.(
                "results.fixMistakes"
              ) || "Исправить ошибки";

            fixBtn.textContent = `${baseFixText} (${session.mistakes.length})`;

            // вставляем слева от restartBtn
            restartBtn.parentNode.insertBefore(
              fixBtn,
              restartBtn
            );

            // обработчик запуска режима исправления
            fixBtn.addEventListener(
              "click",
              () => {
                startCorrectionMode();
              }
            );
          }
        }
      });
    }

    /**
     * Запуск режима исправления ошибок.
     * - ставим флаг correctingMode
     * - сбрасываем статистику/счётчики/таймер/экран
     * - монтируем обратно шаг 3 с новой серией = только ошибки
     */
    function startCorrectionMode() {
      // переносим очередь ошибок,
      // если вдруг не перенесли ранее
      session.correctionQueue =
        session.mistakes.map((m) => ({
          steps: m.steps,
          answer: m.answer
        }));

      if (session.correctionQueue.length === 0) {
        return;
      }

      // включаем режим исправления
      session.correctingMode = true;

      // сбрасываем счётчики серии (для панели справа)
      session.stats.correct = 0;
      session.stats.incorrect = 0;
      session.stats.total =
        session.correctionQueue.length;
      session.completed = 0;

      updateStats();

      // переключаемся визуально обратно на шаг тренировки.
      // В твоей навигации это может быть свой механизм.
      // Здесь мы шлём событие (чтобы внешний экран знал,
      // что надо вернуться к шагу "Тренування")
      eventBus.emit?.(
        EVENTS.START_CORRECTION_MODE,
        {}
      ) ||
        eventBus.publish?.(
          EVENTS.START_CORRECTION_MODE,
          {}
        );

      // и сразу показываем первый "ошибочный" пример
      showNextExample();
    }

    // === listeners ===
    const listeners = [];

    function addListener(
      element,
      event,
      handler
    ) {
      if (!element) return;
      element.addEventListener(
        event,
        handler
      );
      listeners.push({
        element,
        event,
        handler
      });
    }

    // показать/скрыть абакус
    addListener(
      document.getElementById(
        "btn-show-abacus"
      ),
      "click",
      () => {
        abacusWrapper.classList.toggle(
          "visible"
        );
        const btn =
          document.getElementById(
            "btn-show-abacus"
          );
        if (btn) {
          btn.textContent = abacusWrapper.classList.contains(
            "visible"
          )
            ? t?.(
                "trainer.hideAbacus"
              ) || "🧮 Скрыть абакус"
            : t?.(
                "trainer.showAbacus"
              ) ||
              "🧮 Показать абакус";
        }
      }
    );

    // закрыть абакус по крестику
    addListener(
      document.getElementById(
        "btn-close-abacus"
      ),
      "click",
      () => {
        abacusWrapper.classList.remove(
          "visible"
        );
        const btn =
          document.getElementById(
            "btn-show-abacus"
          );
        if (btn) {
          btn.textContent =
            t?.(
              "trainer.showAbacus"
            ) || "🧮 Показать абакус";
        }
      }
    );

    // ответить
    addListener(
      document.getElementById("btn-submit"),
      "click",
      checkAnswer
    );

    // [Enter] в поле ввода
    addListener(
      document.getElementById(
        "answer-input"
      ),
      "keypress",
      (e) => {
        if (e.key === "Enter")
          checkAnswer();
      }
    );

    // новая кнопка "Выйти"
    // мы просто шлём наружу событие,
    // чтобы оболочка приложения вернулась на экран настроек (шаг 1)
    addListener(
      document.getElementById(
        "btn-exit-training"
      ),
      "click",
      () => {
        logger.info(
          CONTEXT,
          "Exit training requested"
        );
        stopAnswerTimer();
        showAbort = true;
        isShowing = false;
        overlay.clear();
        abacusWrapper.classList.remove(
          "visible"
        );

        // говорим приложению "вернись на настройки"
        eventBus.emit?.(
          EVENTS.TRAINING_EXIT,
          {}
        ) ||
          eventBus.publish?.(
            EVENTS.TRAINING_EXIT,
            {}
          );
      }
    );

    // === Общий таймер серии (если включён в настройках)
    if (
      st.timeLimitEnabled &&
      st.timePerExampleMs > 0
    ) {
      startAnswerTimer(
        st.timePerExampleMs,
        {
          onExpire: () => {
            logger.warn(
              CONTEXT,
              "Series time expired!"
            );
            finishTraining();
          },
          textElementId:
            "answerTimerText",
          barSelector:
            "#answer-timer .bar"
        }
      );
    }

    // === Таймер на конкретный пример (инд. время)
    if (
      st.perExampleTimerEnabled &&
      st.perExampleTimeMs > 0
    ) {
      startAnswerTimer(
        st.perExampleTimeMs,
        {
          onExpire: () =>
            handleTimeExpired(),
          textElementId:
            "answerTimerText",
          barSelector:
            "#answer-timer .bar"
        }
      );
    }

    // === GO! ===
    showNextExample();
    logger.info(
      CONTEXT,
      `Trainer started (${abacusColumns} columns for ${digits}-digit numbers)`
    );

    // === cleanup ===
    return () => {
      const wrapper =
        document.getElementById(
          "abacus-wrapper"
        );
      if (wrapper) wrapper.remove();
      showAbort = true;
      isShowing = false;
      overlay.clear();
      stopAnswerTimer();

      listeners.forEach(
        ({ element, event, handler }) => {
          element.removeEventListener(
            event,
            handler
          );
        }
      );

      logger.debug(
        CONTEXT,
        "Trainer unmounted, listeners cleaned up"
      );
    };
  } catch (err) {
    showFatalError(err);
  }
}

/** Fatal error UI */
function showFatalError(err) {
  const msg =
    err?.stack ||
    err?.message ||
    String(err);
  logger.error(CONTEXT, "Fatal error:", err);

  const host =
    document.querySelector(
      ".screen__body"
    ) || document.body;

  const errorDiv =
    document.createElement("div");
  errorDiv.style.cssText =
    "color:#d93025;padding:16px;white-space:pre-wrap";

  const title = document.createElement("b");
  title.textContent =
    "Не удалось загрузить тренажёр.";

  const br = document.createElement("br");

  const message =
    document.createTextNode(msg);

  errorDiv.append(title, br, message);
  host.insertBefore(
    errorDiv,
    host.firstChild
  );
}

/** Сколько примеров в обычной серии */
function getExampleCount(examplesCfg) {
  if (!examplesCfg)
    return DEFAULTS.EXAMPLES_COUNT;
  return examplesCfg.infinite
    ? DEFAULTS.EXAMPLES_COUNT
    : examplesCfg.count ??
        DEFAULTS.EXAMPLES_COUNT;
}
