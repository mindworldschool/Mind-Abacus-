// ui/game.js — Экран тренировки (интеграция тренажёра)
import { createButton, createStepIndicator } from "./helper.js";
import { setResults } from "../core/state.js";

export async function renderGame(container, { t, state, navigate }) {
  // Очистка контейнера
  container.innerHTML = "";

  // Создаём структуру экрана
  const section = document.createElement("section");
  section.className = "screen game-screen";

  // Индикатор шагов (Settings → Confirmation → Game → Results)
  const indicator = createStepIndicator("game", t);
  section.appendChild(indicator);

  // Тело (сюда монтируется тренажёр)
  const body = document.createElement("div");
  body.className = "screen__body";
  section.appendChild(body);

  container.appendChild(section);

  try {
    // 🧩 Динамически импортируем тренажёр (точный путь!)
    const module = await import("../ext/trainer_ext.js");

    if (!module?.mountTrainerUI) {
      throw new Error("Модуль trainer_ext.js загружен, но mountTrainerUI не найден");
    }

    console.log("🎮 Монтируем тренажёр...");
    module.mountTrainerUI(body, { t, state });

  } catch (error) {
    console.error("❌ Ошибка загрузки тренажёра:", error);
    body.innerHTML = `
      <div style="color:#d93025; padding:20px; font-weight:600;">
        Не удалось загрузить тренажёр.<br/>
        <small>${error.message}</small>
      </div>`;
  }

  // === Коллбэк для завершения тренировки ===
  window.finishTraining = (stats) => {
    setResults({
      success: stats.correct || 0,
      total: stats.total || 10
    });
    navigate("results");
  };
}
