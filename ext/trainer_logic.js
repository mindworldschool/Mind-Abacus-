// ext/trainer_logic.js — Main trainer logic (final stable version)

import { ExampleView } from "./components/ExampleView.js";
import { Abacus } from "./components/AbacusNew.js";
import { ExampleGenerator } from "./core/ExampleGenerator.js";
import { BigStepOverlay } from "../ui/components/BigStepOverlay.js";
import { playSound } from "../js/utils/sound.js";
import { logger } from "../core/utils/logger.js";
import { UI, FONT_SIZE, DEFAULTS } from "../core/utils/constants.js";
import { eventBus, EVENTS } from "../core/eventBus.js";
import toast from "../ui/components/Toast.js";

const CONTEXT = "Trainer";

// === Layout creation helpers ===

function createTrainerLayout(displayMode, exampleCount) {
  const layout = document.createElement("div");
  layout.className = `mws-trainer mws-trainer--${displayMode}`;

  const trainerMain = document.createElement("div");
  trainerMain.className = `trainer-main trainer-main--${displayMode}`;

  const exampleArea = document.createElement("div");
  exampleArea.id = "area-example";
  exampleArea.className = "example-view";
  trainerMain.appendChild(exampleArea);

  const panelControls = document.createElement("div");
  panelControls.id = "panel-controls";

  // Answer input
  const answerSection = document.createElement("div");
  answerSection.className = "answer-section-panel";

  const label = document.createElement("div");
  label.className = "answer-label";
  label.textContent = "Ответ:";

  const input = document.createElement("input");
  input.type = "number";
  input.id = "answer-input";
  input.placeholder = "";

  const submit = document.createElement("button");
  submit.className = "btn btn--primary";
  submit.id = "btn-submit";
  submit.textContent = "Ответить";

  answerSection.append(label, input, submit);

  const resultsCapsule = createResultsCapsule(exampleCount);
  const progress = createProgressContainer();

  const timerContainer = document.createElement("div");
  timerContainer.id = "answer-timer";
  const timerBar = document.createElement("div");
  timerBar.className = "bar";
  timerContainer.appendChild(timerBar);

  const timerText = document.createElement("div");
  timerText.id = "answerTimerText";
  timerText.className = "answer-timer__text";

  const panelCard = document.createElement("div");
  panelCard.className = "panel-card panel-card--compact";
  const abacusBtn = document.createElement("button");
  abacusBtn.className = "btn btn--secondary btn--fullwidth";
  abacusBtn.id = "btn-show-abacus";
  abacusBtn.textContent = "🧮 Показать абакус";
  panelCard.appendChild(abacusBtn);

  panelControls.append(
    answerSection,
    resultsCapsule,
    progress,
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

function createProgressContainer() {
  const container = document.createElement("div");
  container.className = "progress-container";

  const bar = document.createElement("div");
  bar.className = "progress-bar";

  const correct = document.createElement("div");
  correct.className = "progress-bar__correct";
  correct.id = "progress-correct";
  correct.style.width = "0%";

  const incorrect = document.createElement("div");
  incorrect.className = "progress-bar__incorrect";
  incorrect.id = "progress-incorrect";
  incorrect.style.width = "0%";

  bar.append(correct, incorrect);

  const labels = document.createElement("div");
  labels.className = "progress-label";

  const correctLabel = document.createElement("span");
  correctLabel.className = "progress-label__correct";
  correctLabel.textContent = "Правильно: ";
  const correctPercent = document.createElement("strong");
  correctPercent.id = "percent-correct";
  correctPercent.textContent = "0%";
  correctLabel.append(correctPercent);

  const incorrectLabel = document.createElement("span");
  incorrectLabel.className = "progress-label__incorrect";
  incorrectLabel.textContent = "Ошибки: ";
  const incorrectPercent = document.createElement("strong");
  incorrectPercent.id = "percent-incorrect";
  incorrectPercent.textContent = "0%";
  incorrectLabel.append(incorrectPercent);

  labels.append(correctLabel, incorrectLabel);
  container.append(bar, labels);
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

  const close = document.createElement("button");
  close.className = "abacus-close-btn";
  close.id = "btn-close-abacus";
  close.title = "Закрыть";
  close.textContent = "×";

  header.append(title, close);

  const container = document.createElement("div");
  container.id = "floating-abacus-container";

  wrapper.append(header, container);
  return wrapper;
}

// === Main mountTrainerUI ===
export function mountTrainerUI(container, { t, state }) {
  try {
    logger.info(CONTEXT, "Mounting trainer UI...");
    const st = state?.settings ?? {};
    const displayMode = st.inline ? "inline" : "column";
    const digits = parseInt(st.digits, 10) || 1;
    const exampleCount = st.examples?.count ?? DEFAULTS.EXAMPLES_COUNT;

    const layout = createTrainerLayout(displayMode, exampleCount);
    container.appendChild(layout);

    // Abacus
    const oldAbacus = document.getElementById("abacus-wrapper");
    if (oldAbacus) oldAbacus.remove();

    const abacusWrapper = createAbacusWrapper();
    document.body.appendChild(abacusWrapper);
    const abacus = new Abacus(
      document.getElementById("floating-abacus-container"),
      digits + 1
    );

    const overlayColor =
      getComputedStyle(document.documentElement).getPropertyValue(
        "--color-primary"
      )?.trim() || "#EC8D00";
    const overlay = new BigStepOverlay(UI.BIG_DIGIT_SCALE, overlayColor);
    const exampleView = new ExampleView(document.getElementById("area-example"));

    // === Example generation ===
    const rule = st.rule ?? {
      name: "default",
      config: { digitCount: digits },
      generateStartState: () => 0,
      generateStepsCount: () => 5,
      getAvailableActions: () => [1, 2, 3, -1, -2],
      applyAction: (s, a) => s + a,
      stateToNumber: s => s,
    };
    const generator = new ExampleGenerator(rule);

    const session = {
      stats: { correct: 0, incorrect: 0, total: exampleCount },
      completed: 0,
      wrongExamples: [],
      currentExample: null,
    };

    // === Font size adaptation ===
    function adaptFont(actions, digits) {
      const lines = document.querySelectorAll("#area-example .example__line");
      if (!lines.length) return;
      const actionsF = Math.min(actions, 12) / 12;
      const digitsF = Math.min(digits, 9) / 9;
      const factor = (actionsF + digitsF) / 2;
      const min = 24,
        max = 96;
      const size = max - factor * (max - min);
      lines.forEach(line => {
        line.style.setProperty("font-size", `${Math.round(size)}px`, "important");
        line.style.setProperty("line-height", "1.2", "important");
      });
    }

    // === Show example ===
    async function showNextExample() {
      if (session.completed >= session.stats.total) return finishSession();

      session.currentExample = generator.generate();
      const ex = session.currentExample;
      const steps = ex.steps ?? [];
      const actionsLen = steps.length;
      let maxDigits = 1;
      steps.forEach(s => {
        const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10);
        if (!isNaN(n)) maxDigits = Math.max(maxDigits, Math.abs(n).toString().length);
      });

      const input = document.getElementById("answer-input");
      input.value = "";

      const shouldDict = actionsLen > 12;
      const showSpeed = st.showSpeedMs || 0;
      const showSpeedActive = st.showSpeedEnabled && showSpeed > 0;

      if (shouldDict || showSpeedActive) {
        exampleView.clear();
      } else {
        exampleView.render(steps, displayMode);
        requestAnimationFrame(() => adaptFont(actionsLen, maxDigits));
      }

      if (shouldDict || showSpeedActive) {
        await playSequential(steps, showSpeedActive ? showSpeed : 2000);
      }

      input.disabled = false;
      input.focus();
    }

    // === Sequential steps ===
    async function playSequential(steps, ms) {
      for (let i = 0; i < steps.length; i++) {
        const color = i % 2 === 0 ? "#EC8D00" : "#6db45c";
        overlay.show(formatStep(steps[i]), color);
        try { playSound("tick"); } catch {}
        await delay(ms);
        overlay.hide();
        await delay(UI.DELAY_BETWEEN_STEPS_MS);
      }
      overlay.clear();
    }

    function formatStep(step) {
      const n = Number(step);
      if (Number.isNaN(n)) return String(step);
      return n >= 0 ? `+${n}` : `${n}`;
    }

    function delay(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

    // === Check answer ===
    function checkAnswer() {
      const input = document.getElementById("answer-input");
      const val = parseInt(input.value, 10);
      if (isNaN(val)) {
        toast.warning("Введите число");
        return;
      }
      const isCorrect = val === session.currentExample.answer;
      if (isCorrect) session.stats.correct++;
      else {
        session.stats.incorrect++;
        session.wrongExamples.push({ example: session.currentExample, userAnswer: val });
      }
      session.completed++;
      updateStats();
      playSound(isCorrect ? "correct" : "wrong");
      setTimeout(() => showNextExample(), UI.TRANSITION_DELAY_MS);
    }

    function updateStats() {
      const { correct, incorrect } = session.stats;
      const done = session.completed;
      const total = session.stats.total;
      document.getElementById("stats-completed").textContent = String(done);
      document.getElementById("stats-correct").textContent = String(correct);
      document.getElementById("stats-incorrect").textContent = String(incorrect);
      const pC = done ? Math.round((correct / done) * 100) : 0;
      const pI = done ? Math.round((incorrect / done) * 100) : 0;
      document.getElementById("progress-correct").style.width = pC + "%";
      document.getElementById("progress-incorrect").style.width = pI + "%";
      document.getElementById("percent-correct").textContent = pC + "%";
      document.getElementById("percent-incorrect").textContent = pI + "%";
    }

    function finishSession() {
      overlay.clear();
      abacusWrapper.classList.remove("visible");
      eventBus.publish(EVENTS.TRAINING_FINISH, {
        correct: session.stats.correct,
        total: session.stats.total,
        wrongExamples: session.wrongExamples,
      });
      logger.info(CONTEXT, "Training finished", session.stats);
    }

    // === Listeners ===
    const listeners = [];

    function addListener(el, ev, fn) {
      if (!el) return;
      el.addEventListener(ev, fn);
      listeners.push({ el, ev, fn });
    }

    addListener(document.getElementById("btn-submit"), "click", checkAnswer);
    addListener(document.getElementById("answer-input"), "keypress", e => {
      if (e.key === "Enter") checkAnswer();
    });

    addListener(document.getElementById("btn-show-abacus"), "click", () => {
      abacusWrapper.classList.toggle("visible");
      const btn = document.getElementById("btn-show-abacus");
      btn.textContent = abacusWrapper.classList.contains("visible")
        ? "🧮 Скрыть абакус"
        : "🧮 Показать абакус";
    });

    addListener(document.getElementById("btn-close-abacus"), "click", () => {
      abacusWrapper.classList.remove("visible");
      document.getElementById("btn-show-abacus").textContent = "🧮 Показать абакус";
    });

    // === Start trainer ===
    showNextExample();
    logger.info(CONTEXT, "Trainer started");

    return () => {
      listeners.forEach(({ el, ev, fn }) => el.removeEventListener(ev, fn));
      overlay.clear();
      const w = document.getElementById("abacus-wrapper");
      if (w) w.remove();
    };
  } catch (err) {
    showFatalError(err);
  }
}

// === Fatal error view ===
function showFatalError(err) {
  const msg = err?.stack || err?.message || String(err);
  console.error("❌ Trainer fatal error:", msg);
  const host = document.querySelector(".screen__body") || document.body;
  const div = document.createElement("div");
  div.style.cssText = "color:#d93025;padding:16px;white-space:pre-wrap";
  div.innerHTML = `<b>Не удалось загрузить тренажёр.</b><br>${msg}`;
  host.insertBefore(div, host.firstChild);
}
