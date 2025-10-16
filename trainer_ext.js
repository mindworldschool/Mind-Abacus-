import { preloadSounds, playSound } from '../js/utils/sound.js';
import { startTimer, stopTimer } from '../js/utils/timer.js';

// Инициализация
preloadSounds();

// Проверка
setTimeout(() => {
  playSound('correct'); // должен сыграть звук
  console.log('✅ Sound module loaded!');
}, 1000);

// ext/trainer_ext.js
import { t } from "../core/i18n.js";
import { state } from "../core/state.js";
import { mountTrainerUI } from "./trainer_logic.js";

(async () => {
  // Находим основной контейнер приложения
  const appRoot = document.getElementById("app");
  if (!appRoot) {
    console.error("❌ Не найден контейнер #app для тренажёра.");
    return;
  }

  console.log("✅ TrainerView initialized on #app");
  mountTrainerUI(appRoot, { t, state });
})();
