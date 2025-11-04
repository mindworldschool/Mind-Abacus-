// ui/game.js
import { createStepIndicator } from "./helper.js";
import { fitTextToBox } from "./utils/fitText.js";
import { setResults } from "../core/state.js";
import { eventBus, EVENTS } from "../core/utils/events.js";
import { logger } from "../core/utils/logger.js";
import toast from "./components/Toast.js";

const CONTEXT = "GameScreen";

/**
 * Ожидаемый интерфейс example:
 *  - display: 'column' | 'big'
 *  - lines?: string[]          // для column
 *  - big?: string              // для big, напр. "+13126"
 */
function mountExample(canvasEl, example) {
  // Очистить «полотно»
  canvasEl.innerHTML = "";

  // Создать контейнер с выражением
  const expr = document.createElement("div");
  expr.className =
    example.display === "column" ? "expr expr--column" : "expr expr--big";

  if (example.display === "column") {
    // построчный вывод: +544, +455, -713...
    example.lines.forEach((text) => {
      const line = document.createElement("div");
      line.className = "line";
      line.textContent = text;
      expr.appendChild(line);
    });
  } else {
    // одно большое число
    expr.textContent = example.big ?? "";
  }

  canvasEl.appendChild(expr);

  // Автоматическая подгонка размера (только для большого числа)
  if (example.display === "big") {
    // Первичная подгонка
    fitTextToBox(expr, canvasEl, { padding: 24, minScale: 0.6 });

    // Реакция на изменения размеров
    const ro = new ResizeObserver(() =>
      fitTextToBox(expr, canvasEl, { padding: 24, minScale: 0.6 })
    );
    ro.observe(canvasEl);

    // На всякий случай — ресайз окна
    window.addEventListener(
      "resize",
      () => fitTextToBox(expr, canvasEl, { padding: 24, minScale: 0.6 }),
      { passive: true }
    );
  }
}

export async function renderGame(container, { t, state, navigate }) {
  container.innerHTML = "";

  const section = document.createElement("section");
  section.className = "screen game-screen";

  const indicator = createStepIndicator("game", t);
  section.appendChild(indicator);

  const body = document.createElement("div");
  body.className = "screen__body";
  section.appendChild(body);

  // === ЛЕВАЯ колонка: белое «полотно» для примеров ===
  const canvasWrap = document.createElement("div");
  canvasWrap.className = "trainer-canvas"; // важный класс для стилей центрирования
  body.appendChild(canvasWrap);

  // === ПРАВАЯ колонка: панель ответа (монтируется как раньше) ===
  const sidebar = document.createElement("div");
  sidebar.className = "trainer-sidebar";
  sidebar.innerHTML = `
    <div class="answer">
      <label class="answer__label">${t("game.answer") ?? "Відповідь:"}</label>
      <input class="answer__input" type="text" inputmode="numeric" />
      <button class="answer__btn">${t("game.reply") ?? "Відповісти"}</button>
    </div>

    <div class="stats">
      <div class="stats__header">
        <span>${t("game.actions") ?? "Кількість дій"}</span>
        <span class="stats__limit">0 / 2</span>
      </div>
      <div class="stats__grid">
        <div class="stats__ok">
          <span>✓</span><b class="ok">0</b>
        </div>
        <div class="stats__bad">
          <span>✗</span><b class="bad">0</b>
        </div>
      </div>
      <div class="progress">
        <div class="progress__ok">${t("game.correct") ?? "Правильно:"} <b>0%</b></div>
        <div class="progress__bad">${t("game.errors") ?? "Помилки:"} <b>0%</b></div>
      </div>
    </div>
  `;
  body.appendChild(sidebar);

  container.appendChild(section);

  // ==== Подписки на события тренажёра (как и раньше) ====
  const unsubscribe = eventBus.on(EVENTS.TRAINING_FINISH, (stats) => {
    logger.info(CONTEXT, "Training finished, navigating to results");
    setResults(stats);
    navigate("results");
  });

  // Если в твоей логике уже есть «рендер примера», используй mountExample.
  // Ниже — демонстрация: становим «колонку» при >1 действия, иначе «одно число».
  const currentExample = state?.example ?? {
    display: (state?.actionsCount ?? 1) > 1 ? "column" : "big",
    lines:
      state?.lines ??
      ["+544", "+455", "-713", "-175", "+785", "-315", "-561", "+259", "-129"],
    big: state?.big ?? "+13126",
  };

  mountExample(canvasWrap, currentExample);

  // При размонтировании
  section.addEventListener("removed", () => {
    unsubscribe?.();
  });
}
