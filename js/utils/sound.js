/**
 * sound.js - Модуль для воспроизведения звуковых эффектов
 * 
 * ИСПОЛЬЗОВАНИЕ:
 * import { playSound, preloadSounds } from './utils/sound.js';
 * 
 * preloadSounds(); // вызвать один раз при загрузке
 * playSound('success'); // воспроизвести звук
 */

// Хранилище аудио-объектов
const sounds = {};

// Пути к звуковым файлам (адаптировано под структуру проекта)
const soundPaths = {
  correct: './assets/sfx_correct.mp3',  // правильный ответ
  wrong: './assets/sfx_wrong.mp3',      // неправильный ответ
  next: './assets/sfx_next.mp3'          // следующий пример
};

/**
 * Предзагрузка всех звуков
 * Вызывать один раз при инициализации приложения
 */
export function preloadSounds() {
  Object.keys(soundPaths).forEach(name => {
    sounds[name] = new Audio(soundPaths[name]);
    sounds[name].preload = 'auto';
  });
  
  console.log('✅ Звуки предзагружены:', Object.keys(sounds));
}

/**
 * Воспроизведение звука по имени
 * @param {string} name - Имя звука: 'correct', 'wrong', 'next'
 */
export function playSound(name) {
  if (!sounds[name]) {
    console.warn(`⚠️ Звук "${name}" не найден. Доступные:`, Object.keys(sounds));
    return;
  }
  
  try {
    // Сброс на начало для повторного воспроизведения
    sounds[name].currentTime = 0;
    sounds[name].play();
  } catch (error) {
    console.error(`❌ Ошибка воспроизведения звука "${name}":`, error);
  }
}

/**
 * Отключение/включение звуков
 * @param {boolean} muted - true = отключить звук
 */
export function setMuted(muted) {
  Object.values(sounds).forEach(audio => {
    audio.muted = muted;
  });
}

/**
 * Установка громкости (0.0 - 1.0)
 * @param {number} volume - Громкость от 0 до 1
 */
export function setVolume(volume) {
  const clampedVolume = Math.max(0, Math.min(1, volume));
  Object.values(sounds).forEach(audio => {
    audio.volume = clampedVolume;
  });
}