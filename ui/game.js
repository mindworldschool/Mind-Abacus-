// ui/game.js - Экран тренировки (интегрирует тренажёр)
import { createButton, createStepIndicator } from "./helper.js";
import { setResults } from "../core/state.js";

export function renderGame(container, { t, state, navigate }) {
  // Очищаем контейнер
  container.innerHTML = "";
  
  // Создаём обёртку для экрана игры
  const section = document.createElement("section");
  section.className = "screen game-screen";
  
  // Индикатор шагов (Settings → Confirmation → Game → Results)
  const indicator = createStepIndicator("game", t);
  section.appendChild(indicator);
  
  // Тело экрана (здесь будет тренажёр) БЕЗ заголовка
  const body = document.createElement("div");
  body.className = "screen__body";
  section.appendChild(body);
  
  container.appendChild(section);
  
  // Динамически импортируем и монтируем тренажёр
  import('../ext/trainer_ext.js').then(({ mountTrainerUI }) => {
    console.log('🎮 Монтируем тренажёр в экран игры');
    mountTrainerUI(body, { t, state });
  }).catch(error => {
    console.error('❌ Ошибка загрузки тренажёра:', error);
    body.innerHTML = '<p style="color: red;">Не удалось загрузить тренажёр</p>';
  });
  
  // Функция для завершения тренировки и перехода к результатам
  // (будет вызываться из trainer_logic.js позже)
  window.finishTraining = (stats) => {
    setResults({
      success: stats.correct || 0,
      total: stats.total || 10
    });
    navigate("results");
  };
}
