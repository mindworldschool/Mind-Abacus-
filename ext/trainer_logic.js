// ext/trainer_logic.js — Trainer logic (единый выход в глобальный экран результатов)
import { ExampleView } from "./components/ExampleView.js";
import { Abacus } from "./components/AbacusNew.js";
import { generateExample } from "./core/generator.js";
import { startAnswerTimer, stopAnswerTimer } from "../js/utils/timer.js";
import { BigStepOverlay } from "../ui/components/BigStepOverlay.js";
import { playSound } from "../js/utils/sound.js";
import { logger } from "../core/utils/logger.js";
import { UI, DEFAULTS } from "../core/utils/constants.js";
import toast from "../ui/components/Toast.js";

const CONTEXT = "Trainer";

/**
 * ВАЖНО:
 * Этот модуль больше НЕ рендерит финальный экран "Итоги сессии" внутри себя.
 *
 * Вместо этого он:
 *  - ведёт сессию тренировки (основную или retry),
 *  - считает статистику,
 *  - собирает ошибки,
 *  - в конце вызывает внешний колбэк onFinish({ total, success, wrongExamples })
 *
 * Глобальный экран "Результаты" (ui/results.js) уже показывает статистику,
 * кнопки "Исправить ошибки" и "Запустить новое задание".
 *
 * В retry-режиме тренажёр получает заранее список примеров и не генерирует новые.
 *
 * mountTrainerUI(container, {
 *   t,
 *   settings,
 *   retryMode: { enabled: boolean, examples: [...] },
 *   onFinish: ({ total, success, wrongExamples }) => { ... },
 *   onExitTrainer: () => { ... }         // по кнопке Выйти
 * })
 */

export function mountTrainerUI(container, {
  t,
  settings,
  retryMode,
  onFinish,
  onExitTrainer
}) {
  // ---------------------------
  // Инициализация сессии
  // ---------------------------

  const st = settings || {};
  const actionsCfg = st.actions || {};
  const examplesCfg = st.examples || {};
  const blockSimpleDigits = Array.isArray(st?.blocks?.simple?.digits)
    ? st.blocks.simple.digits
    : [];

  // retry режим?
  const isRetrySession = !!retryMode?.enabled;
  const retryQueue = isRetrySession && Array.isArray(retryMode.examples)
    ? [...retryMode.examples]
    : [];

  // сколько примеров в этой сессии:
  const totalExamples = isRetrySession
    ? retryQueue.length
    : getExampleCount(examplesCfg);

  const digits = parseInt(st.digits, 10) || 1;
  const abacusColumns = digits + 1;
  const displayMode = st.inline ? "inline" : "column";

  // состояние
  const session = {
    currentExample: null,
    total: totalExamples,
    completed: 0,
    correct: 0,
    wrong: 0,
    wrongExamples: [] // [{steps:[], answer:number, userAnswer:number|null}]
  };

  // ---------------------------
  // Рендер основного тренажёра
  // ---------------------------

  const layout = createTrainerLayout(displayMode, totalExamples, t);
  container.innerHTML = "";
  container.appendChild(layout);

  // создаём абакус-оверлей
  const existingAbacus = document.getElementById("abacus-wrapper");
  if (existingAbacus) existingAbacus.remove();

  const abacusWrapper = createAbacusWrapper();
  document.body.appendChild(abacusWrapper);

  const exampleView = new ExampleView(document.getElementById("area-example"));

  const abacus = new Abacus(
    document.getElementById("floating-abacus-container"),
    abacusColumns
  );

  const overlayColor =
    getComputedStyle(document.documentElement).getPropertyValue("--color-primary")?.trim()
    || "#EC8D00";
  const overlay = new BigStepOverlay(
    st.bigDigitScale ?? UI.BIG_DIGIT_SCALE,
    overlayColor
  );

  if (st.mode === "abacus") {
    abacusWrapper.classList.add("visible");
    const btn = document.getElementById("btn-show-abacus");
    if (btn) {
      btn.textContent = t?.("trainer.hideAbacus") || "🧮 Скрыть абакус";
    }
  }

  let isShowing = false;
  let abortShow = false;

  // ---------------------------
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI
  // ---------------------------

  function adaptExampleFontSize(actionsCount, maxDigitsLen) {
    const lines = document.querySelectorAll("#area-example .example__line");
    if (!lines.length) return;

    // Оцениваем "сложность": чем больше шагов и длина чисел — тем меньше шрифт
    const actionsFactor = Math.min(actionsCount, 12) / 12; // 0..1
    const digitsFactor  = Math.min(maxDigitsLen, 9) / 9;    // 0..1
    const complexity    = (actionsFactor + digitsFactor) / 2;

    const MIN = 24;
    const MAX = 96;
    const px  = MAX - complexity * (MAX - MIN);

    lines.forEach(line => {
      line.style.setProperty("font-size", `${Math.round(px)}px`, "important");
      line.style.setProperty("line-height", "1.2", "important");
    });
  }

  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  function formatStep(step) {
    // steps у нас уже с знаком "+3" "-7", не надо добавлять "+"
    return String(step);
  }

  async function playSequential(steps, intervalMs, { beepOnStep = false } = {}) {
    try {
      for (let i = 0; i < steps.length; i++) {
        if (abortShow) break;

        const isOdd = i % 2 === 0;
        const color = isOdd ? "#EC8D00" : "#6db45c";

        overlay.show(formatStep(steps[i]), color);
        if (beepOnStep) playSound("tick");

        await delay(intervalMs);
        overlay.hide();
        await delay(UI.DELAY_BETWEEN_STEPS_MS);
      }
    } finally {
      overlay.clear();
    }
  }

  function updateStatsUI() {
    const q = id => document.getElementById(id);

    // счётчики
    if (q("stats-completed")) q("stats-completed").textContent = String(session.completed);
    if (q("stats-correct"))   q("stats-correct").textContent   = String(session.correct);
    if (q("stats-incorrect")) q("stats-incorrect").textContent = String(session.wrong);

    // проценты
    const answered = session.completed || 1;
    const pc = Math.round((session.correct / answered) * 100);
    const pw = Math.round((session.wrong   / answered) * 100);

    if (q("progress-correct"))   q("progress-correct").style.width   = pc + "%";
    if (q("progress-incorrect")) q("progress-incorrect").style.width = pw + "%";
    if (q("percent-correct"))    q("percent-correct").textContent    = pc + "%";
    if (q("percent-incorrect"))  q("percent-incorrect").textContent  = pw + "%";
  }

  function buildGeneratorSettings() {
    const selectedDigits =
      blockSimpleDigits.length > 0
        ? blockSimpleDigits.map(d => parseInt(d, 10))
        : [1, 2, 3, 4];

    // определяем min/max для генератора
    const genMin = actionsCfg.infinite === true
      ? DEFAULTS.ACTIONS_MIN
      : (actionsCfg.min ??
         actionsCfg.count ??
         DEFAULTS.ACTIONS_MIN);

    const genMax = actionsCfg.infinite === true
      ? DEFAULTS.ACTIONS_MAX
      : (actionsCfg.max ??
         actionsCfg.count ??
         DEFAULTS.ACTIONS_MAX);

    return {
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
        brothers: { active: st.blocks?.brothers?.active ?? false },
        friends:  { active: st.blocks?.friends?.active  ?? false },
        mix:      { active: st.blocks?.mix?.active      ?? false }
      },
      actions: {
        min:      genMin,
        max:      genMax,
        count:    actionsCfg.count,
        infinite: actionsCfg.infinite === true
      },
      digits: st.digits,
      combineLevels: st.combineLevels || false
    };
  }

  function getNextExample() {
    if (isRetrySession) {
      // берём уже готовые ошибочные примеры
      const idx = session.completed;
      if (idx >= retryQueue.length) {
        return null;
      }
      const wrongEx = retryQueue[idx];
      return {
        steps: wrongEx.steps.slice(),
        answer: wrongEx.answer
      };
    }

    // обычная генерация
    return generateExample(buildGeneratorSettings());
  }

  async function showNextExample() {
    overlay.clear();
    abortShow = true;
    isShowing = false;

    // все примеры решены?
    if (session.completed >= session.total) {
      return finishTraining();
    }

    // получить пример
    const ex = getNextExample();
    if (!ex || !Array.isArray(ex.steps)) {
      return finishTraining();
    }

    session.currentExample = ex;

    // посчитать сложность для адаптивного шрифта
    const actionsLen = ex.steps.length;
    let maxDigitsLen = 1;
    for (const step of ex.steps) {
      const num = parseInt(String(step).replace(/[^\d-]/g, ""), 10);
      if (!isNaN(num)) {
        const lenAbs = Math.abs(num).toString().length;
        if (lenAbs > maxDigitsLen) maxDigitsLen = lenAbs;
      }
    }

    const answerInput = document.getElementById("answer-input");
    if (answerInput) answerInput.value = "";

    // режим "диктовки"
    const shouldUseDictation = actionsLen > 12;
    const effectiveShowSpeed = shouldUseDictation
      ? 2000
      : (st.showSpeedMs || 0);
    const showSpeedActive = st.showSpeedEnabled && effectiveShowSpeed > 0;

    // Рендерим пример или чистим (если диктовка)
    if (showSpeedActive || shouldUseDictation) {
      exampleView.clear();
    } else {
      exampleView.render(ex.steps, displayMode);
      requestAnimationFrame(() => {
        adaptExampleFontSize(actionsLen, maxDigitsLen);
      });
    }

    // блокировка ввода во время показа
    const lockDuringShow = st.lockInputDuringShow !== false;
    if (answerInput) answerInput.disabled = lockDuringShow;

    if (showSpeedActive || shouldUseDictation) {
      isShowing = true;
      abortShow = false;
      await playSequential(ex.steps, effectiveShowSpeed, { beepOnStep: !!st.beepOnStep });
      if (abortShow) return;
      await delay(st.showSpeedPauseAfterChainMs ?? UI.PAUSE_AFTER_CHAIN_MS);
      isShowing = false;
      if (lockDuringShow && answerInput) {
        answerInput.disabled = false;
        answerInput.focus();
      }
    } else {
      if (answerInput) {
        answerInput.disabled = false;
        answerInput.focus();
      }
    }

    logger.debug(
      CONTEXT,
      "New example:",
      ex.steps,
      "Answer:",
      ex.answer,
      "retry? ",
      isRetrySession
    );
  }

  function submitAnswer() {
    const answerInput = document.getElementById("answer-input");
    if (!answerInput) return;

    // защита: не даём отвечать раньше времени, если запрещено
    if (isShowing && st.lockInputDuringShow !== false) return;

    const userAnswer = parseInt(answerInput.value ?? "", 10);
    if (Number.isNaN(userAnswer)) {
      toast.warning(t?.("trainer.pleaseEnterNumber") || "Пожалуйста, введите число");
      return;
    }

    // если разрешён ранний ответ во время показа — обрываем показ
    if (isShowing && st.lockInputDuringShow === false) {
      abortShow = true;
      isShowing = false;
      overlay.clear();
    }

    const correctAnswer = session.currentExample.answer;
    const isCorrect = (userAnswer === correctAnswer);

    if (isCorrect) {
      session.correct++;
      playSound("correct");
    } else {
      session.wrong++;
      playSound("wrong");
      session.wrongExamples.push({
        steps: session.currentExample.steps.slice(),
        answer: correctAnswer,
        userAnswer
      });
    }

    session.completed++;
    updateStatsUI();

    setTimeout(showNextExample, UI.TRANSITION_DELAY_MS);
  }

  function handleTimeExpired() {
    // пример не успели решить
    playSound("wrong");

    session.wrong++;
    session.completed++;

    session.wrongExamples.push({
      steps: session.currentExample
        ? session.currentExample.steps.slice()
        : [],
      answer: session.currentExample
        ? session.currentExample.answer
        : null,
      userAnswer: null
    });

    updateStatsUI();

    setTimeout(showNextExample, UI.TIMEOUT_DELAY_MS);
  }

  function finishTraining() {
    stopAnswerTimer();
    abortShow = true;
    isShowing = false;
    overlay.clear();
    abacusWrapper.classList.remove("visible");

    logger.info(
      CONTEXT,
      "Training finished:",
      {
        total: session.total,
        correct: session.correct,
        wrong: session.wrong,
        wrongExamples: session.wrongExamples
      },
      "isRetrySession:",
      isRetrySession
    );

    // Отдаём результаты наружу.
    // Глобальный экран "Результаты" покажет:
    //  - Верно
    //  - Ошибки
    //  - кнопку "Исправить ошибки" (если wrongExamples.length > 0 и это НЕ retry)
    //  - кнопку "Запустить новое задание"
    onFinish?.({
      total: session.total,
      success: session.correct,
      wrongExamples: session.wrongExamples.slice(),
      isRetrySession
    });
  }

  // ---------------------------
  // Навешиваем слушателей
  // ---------------------------

  const listeners = [];
  function addListener(el, ev, fn) {
    if (!el) return;
    el.addEventListener(ev, fn);
    listeners.push({ el, ev, fn });
  }

  addListener(
    document.getElementById("btn-show-abacus"),
    "click",
    () => {
      abacusWrapper.classList.toggle("visible");
      const btn = document.getElementById("btn-show-abacus");
      if (btn) {
        btn.textContent = abacusWrapper.classList.contains("visible")
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
      if (btn) {
        btn.textContent = t?.("trainer.showAbacus") || "🧮 Показать абакус";
      }
    }
  );

  addListener(
    document.getElementById("btn-submit"),
    "click",
    submitAnswer
  );

  addListener(
    document.getElementById("answer-input"),
    "keypress",
    (e) => {
      if (e.key === "Enter") submitAnswer();
    }
  );

  // кнопка выхода
  addListener(
    document.getElementById("btn-exit-trainer"),
    "click",
    () => {
      stopAnswerTimer();
      abortShow = true;
      isShowing = false;
      overlay.clear();
      abacusWrapper.classList.remove("visible");

      onExitTrainer?.();
    }
  );

  // ---------------------------
  // таймеры
  // ---------------------------

  // глобальный лимит на всю серию
  if (st.timeLimitEnabled && st.timePerExampleMs > 0) {
    startAnswerTimer(st.timePerExampleMs, {
      onExpire: () => {
        logger.warn(CONTEXT, "Series time expired!");
        finishTraining();
      },
      textElementId: "answerTimerText",
      barSelector: "#answer-timer .bar"
    });
  }

  // лимит на конкретный пример (если нужен покадрово)
  if (st.perExampleTimerEnabled && st.perExampleTimeMs > 0) {
    startAnswerTimer(st.perExampleTimeMs, {
      onExpire: () => handleTimeExpired(),
      textElementId: "answerTimerText",
      barSelector: "#answer-timer .bar"
    });
  }

  // ---------------------------
  // стартуем первую задачу
  // ---------------------------

  showNextExample();
  logger.info(
    CONTEXT,
    `Trainer started (retry=${isRetrySession}, columns=${abacusColumns}, digits=${digits})`
  );

  // ---------------------------
  // cleanup
  // ---------------------------

  return () => {
    const wrapper = document.getElementById("abacus-wrapper");
    if (wrapper) wrapper.remove();

    abortShow = true;
    isShowing = false;
    overlay.clear();
    stopAnswerTimer();

    listeners.forEach(({ el, ev, fn }) => {
      el.removeEventListener(ev, fn);
    });

    logger.debug(CONTEXT, "Trainer unmounted, listeners cleaned up");
  };
}

// ---------- Вспомогательные pure-функции ----------

function createTrainerLayout(displayMode, exampleCount, t) {
  const layout = document.createElement("div");
  layout.className = `mws-trainer mws-trainer--${displayMode}`;

  // MAIN
  const trainerMain = document.createElement("div");
  trainerMain.className = `trainer-main trainer-main--${displayMode}`;

  const exampleArea = document.createElement("div");
  exampleArea.id = "area-example";
  exampleArea.className = "example-view";
  trainerMain.appendChild(exampleArea);

  // SIDE PANEL
  const panelControls = document.createElement("div");
  panelControls.id = "panel-controls";

  // --- Answer section
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
  submitBtn.textContent = t?.("trainer.submitButton") || "Ответить";

  answerSection.append(answerLabel, answerInput, submitBtn);

  // --- Stats capsule
  const resultsCapsuleExt = createResultsCapsule(exampleCount, t);

  // --- Progress container
  const progressContainer = createProgressContainer(t);

  // --- Timer + bar
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
  abacusBtn.textContent = t?.("trainer.showAbacus") || "🧮 Показать абакус";

  panelCard.appendChild(abacusBtn);

  // --- Exit button
  const exitWrapper = document.createElement("div");
  exitWrapper.className = "panel-card panel-card--compact";

  const exitBtn = document.createElement("button");
  exitBtn.id = "btn-exit-trainer";
  exitBtn.className = "btn btn--secondary btn--fullwidth btn--danger";
  exitBtn.textContent = t?.("trainer.exitButton") || "⏹ Выйти";

  exitWrapper.appendChild(exitBtn);

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
  label.textContent = t?.("confirmation.list.actions") || "Примеры:";

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
  correctLabel.textContent = t?.("trainer.correctLabel") || "Правильно: ";
  const correctPercent = document.createElement("strong");
  correctPercent.id = "percent-correct";
  correctPercent.textContent = "0%";
  correctLabel.appendChild(correctPercent);

  const incorrectLabel = document.createElement("span");
  incorrectLabel.className = "progress-label__incorrect";
  incorrectLabel.textContent = t?.("trainer.incorrectLabel") || "Ошибки: ";
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

function getExampleCount(examplesCfg) {
  if (!examplesCfg) return DEFAULTS.EXAMPLES_COUNT;
  return examplesCfg.infinite
    ? DEFAULTS.EXAMPLES_COUNT
    : (examplesCfg.count ?? DEFAULTS.EXAMPLES_COUNT);
}
