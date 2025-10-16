// ext/trainer_ext.js - Инициализация тренажёра
import { preloadSounds } from '../js/utils/sound.js';

// Предзагрузка звуков при загрузке страницы
preloadSounds();

console.log('✅ Тренажёр инициализирован (звуки загружены)');

// Экспортируем функцию монтирования для вызова из ui/game.js
export { mountTrainerUI } from './trainer_logic.js';
