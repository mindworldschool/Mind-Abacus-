// ext/core/generator.js - Генератор примеров на основе настроек

/**
 * Генерация одного примера на основе настроек
 * @param {Object} settings - Настройки из state.settings
 * @returns {Object} Пример: { start, steps, answer }
 */
export function generateExample(settings) {
  // Извлекаем параметры
  const actionCount = settings.actions.infinite ? 10 : settings.actions.count;
  const digits = parseInt(settings.digits, 10) || 1;
  
  // Определяем активные блоки (какие цифры использовать)
  const activeDigits = getActiveDigits(settings);
  
  // Если нет активных цифр, используем базовый набор
  if (activeDigits.length === 0) {
    console.warn('⚠️ Нет активных цифр, используем базовый набор [1, 2, 3, 4]');
  }
  
  // Генерируем пример
  const example = {
    start: 0, // начинаем с 0 для однозначных
    steps: [],
    answer: 0
  };
  
  let current = example.start;
  
  for (let i = 0; i < actionCount; i++) {
    // Выбираем случайную цифру из активных
    const digit = activeDigits[Math.floor(Math.random() * activeDigits.length)];
    const value = parseInt(digit, 10);
    
    // Определяем операцию (+/-)
    const operation = getRandomOperation(settings);
    const delta = operation === '+' ? value : -value;
    
    // Проверяем допустимость (для однозначных: результат должен быть 0-9)
    const next = current + delta;
    if (!isValidResult(next, digits)) {
      i--; // повторяем шаг
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
 * Получить массив активных цифр из настроек блоков
 * @param {Object} settings
 * @returns {Array<string>}
 */
function getActiveDigits(settings) {
  const allDigits = [];
  
  // Собираем цифры из всех активных блоков
  Object.keys(settings.blocks).forEach(blockKey => {
    const block = settings.blocks[blockKey];
    if (block.digits && block.digits.length > 0) {
      allDigits.push(...block.digits);
    }
  });
  
  // Если ничего не выбрано, используем базовые 1-4
  return allDigits.length > 0 ? allDigits : ['1', '2', '3', '4'];
}

/**
 * Определить случайную операцию на основе настроек блоков
 * @param {Object} settings
 * @returns {string} '+' или '-'
 */
function getRandomOperation(settings) {
  // Проверяем, есть ли ограничения в блоках
  const blocks = settings.blocks;
  const hasOnlyAddition = Object.values(blocks).some(b => b.onlyAddition);
  const hasOnlySubtraction = Object.values(blocks).some(b => b.onlySubtraction);
  
  if (hasOnlyAddition && !hasOnlySubtraction) {
    return '+';
  }
  if (hasOnlySubtraction && !hasOnlyAddition) {
    return '-';
  }
  
  // Иначе случайно
  return Math.random() > 0.5 ? '+' : '-';
}

/**
 * Проверка допустимости результата в зависимости от разрядности
 * @param {number} value - Результат операции
 * @param {number} digits - Количество разрядов (1-9)
 * @returns {boolean}
 */
function isValidResult(value, digits) {
  const max = Math.pow(10, digits) - 1; // для 1 разряда: 9, для 2: 99, и т.д.
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
  
  // Если настройки не переданы, используем упрощённую генерацию
  if (!settings) {
    for (let i = 0; i < count; i++) {
      const delta = randomDelta();
      const sign = delta > 0 ? '+' : '';
      examples.push(`${sign}${delta}`);
    }
    return examples;
  }
  
  // Генерируем с учётом настроек
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
