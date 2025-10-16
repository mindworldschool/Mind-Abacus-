/**
 * timer.js - Модуль таймера для отслеживания времени выполнения примера
 * 
 * ИСПОЛЬЗОВАНИЕ:
 * import { startTimer, stopTimer, getElapsedTime } from './utils/timer.js';
 * 
 * startTimer('timer'); // запустить таймер и обновлять элемент #timer
 * const time = stopTimer(); // остановить и получить время в секундах
 */

// Состояние таймера
let timerInterval = null;
let seconds = 0;
let displayElementId = null;

/**
 * Запуск таймера
 * @param {string} elementId - ID элемента для отображения (например, 'timer')
 */
export function startTimer(elementId = 'timer') {
  // Останавливаем предыдущий таймер, если был
  stopTimer();
  
  // Сброс счетчика
  seconds = 0;
  displayElementId = elementId;
  
  // Первое обновление дисплея
  updateDisplay();
  
  // Запуск интервала (каждую секунду)
  timerInterval = setInterval(() => {
    seconds++;
    updateDisplay();
  }, 1000);
  
  console.log('⏱️ Таймер запущен');
}

/**
 * Остановка таймера
 * @returns {number} Прошедшее время в секундах
 */
export function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    console.log(`⏱️ Таймер остановлен: ${seconds} сек`);
  }
  return seconds;
}

/**
 * Получить текущее время без остановки таймера
 * @returns {number} Время в секундах
 */
export function getElapsedTime() {
  return seconds;
}

/**
 * Проверка, запущен ли таймер
 * @returns {boolean}
 */
export function isRunning() {
  return timerInterval !== null;
}

/**
 * Обновление отображения таймера в формате мм:сс
 */
function updateDisplay() {
  if (!displayElementId) return;
  
  const element = document.getElementById(displayElementId);
  if (!element) {
    console.warn(`⚠️ Элемент #${displayElementId} не найден`);
    return;
  }
  
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  element.textContent = `${mm}:${ss}`;
}

/**
 * Форматирование времени в читаемый вид
 * @param {number} totalSeconds - Время в секундах
 * @returns {string} Форматированное время "мм:сс"
 */
export function formatTime(totalSeconds) {
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}