// ext/core/generator.js - Генератор примеров на основе настроек

/**
 * Генерация одного примера на основе настроек
 * @param {Object} settings - Настройки из state.settings
 * @returns {Object} Пример: { start, steps, answer }
 */
export function generateExample(settings) {
  // Извлекаем параметры
  const actionCount = settings.actions?.infinite ? 10 : settings.actions?.count || 10;
  const digits = parseInt(settings.digits, 10) || 1;

  // Получаем диапазон для разрядности
  const { min, max } = getDigitRange(digits);

  const example = {
    start: 0,
    steps: [],
    answer: 0
  };

  let current = example.start;

  for (let i = 0; i < actionCount; i++) {
    // Генерируем случайное число в диапазоне
    const value = randomInt(min, max);

    // Определяем операцию (+/-)
    const operation = getRandomOperation(settings);
    const delta = operation === '+' ? value : -value;

    // Проверка допустимости результата (чтобы не выходило за границы)
    const next = current + delta;
    if (!isValidResult(next, digits)) {
      i--;
      continue;
    }

    example.steps.push(`${operation}${value}`);
    current = next;
  }

  example.answer = current;

  console.log(`🎲 Сгенерирован пример:`, example);
  return example;
}

/**
 * Вычисляет диапазон min–max для заданной разрядности
 * @param {number} digits
 * @returns {{min: number, max: number}}
 */
function getDigitRange(digits) {
  if (digits <= 1) return { min: 1, max: 9 };
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return { min, max };
}

/**
 * Генерация случайного числа в диапазоне [min, max]
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Определить случайную операцию на основе настроек блоков
 * @param {Object} settings
 * @returns {string} '+' или '-'
 */
function getRandomOperation(settings) {
  const blocks = settings.blocks || {};
  const hasOnlyAddition = Object.values(blocks).some(b => b.onlyAddition);
  const hasOnlySubtraction = Object.values(blocks).some(b => b.onlySubtraction);

  if (hasOnlyAddition && !hasOnlySubtraction) return '+';
  if (hasOnlySubtraction && !hasOnlyAddition) return '-';
  return Math.random() > 0.5 ? '+' : '-';
}

/**
 * Проверка допустимости результата в зависимости от разрядности
 * @param {number} value - Результат операции
 * @param {number} digits - Количество разрядов (1-9)
 * @returns {boolean}
 */
function isValidResult(value, digits) {
  const { max } = getDigitRange(digits);
  return value >= 0 && value <= max;
}

/**
 * Генерация массива примеров (для совместимости со старым кодом)
 * @param {number} count - Количество примеров
 * @param {Object} settings - Настройки
 * @returns {Array<Object>}
 */
export function generateExamples(count, settings = null) {
  const examples = [];

  if (!settings) {
    for (let i = 0; i < count; i++) {
      const delta = randomDelta();
      const sign = delta > 0 ? '+' : '';
      examples.push(`${sign}${delta}`);
    }
    return examples;
  }

  for (let i = 0; i < count; i++) {
    const example = generateExample(settings);
    examples.push(example);
  }

  return examples;
}

/**
 * Вспомогательная функция для упрощённой генерации (без настроек)
 * @returns {number}
 */
function randomDelta() {
  const vals = [-4, -3, -2, -1, 1, 2, 3, 4];
  return vals[Math.floor(Math.random() * vals.length)];
}
