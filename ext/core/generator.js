// ext/core/generator.js
import { ExampleGenerator } from './ExampleGenerator.js';
import { UnifiedSimpleRule } from './rules/UnifiedSimpleRule.js';
import { Simple6Rule } from './rules/Simple6Rule.js';
import { Simple7Rule } from './rules/Simple7Rule.js';
import { Simple8Rule } from './rules/Simple8Rule.js';
import { Simple9Rule } from './rules/Simple9Rule.js';

export function generateExample(settings) {
  const rule = createRuleFromSettings(settings);
  const generator = new ExampleGenerator(rule);
  const example = generator.generate();
  return generator.toTrainerFormat(example);
}

function createRuleFromSettings(settings) {
  const { blocks, actions, digits, combineLevels } = settings;

  // === ПАРАМЕТРЫ РАЗРЯДНОСТИ ===
  // Получаем количество разрядов из settings.digits (1=однозначные, 2=двузначные и т.д.)
  const digitCount = parseInt(digits, 10) || 1;

  // === ИЗВЛЕЧЕНИЕ ВЫБРАННЫХ ЦИФР ===
  // Пользователь выбирает, какие цифры использовать (1, 2, 3, 4, 5)
  let selectedDigits = (blocks?.simple?.digits?.length > 0)
    ? blocks.simple.digits.map(d => parseInt(d, 10))
    : [1, 2, 3, 4];

  // === АВТОМАТИЧЕСКОЕ ДОБАВЛЕНИЕ ЗАВИСИМЫХ ЦИФР ===
  // Для работы с цифрами 6-9 нужны базовые компоненты
  // 6 = 5 + 1, 7 = 5 + 2, 8 = 5 + 3, 9 = 5 + 4
  const digitsToAdd = new Set(selectedDigits);

  if (selectedDigits.includes(6)) {
    digitsToAdd.add(5);
    digitsToAdd.add(1);
  }
  if (selectedDigits.includes(7)) {
    digitsToAdd.add(5);
    digitsToAdd.add(2);
  }
  if (selectedDigits.includes(8)) {
    digitsToAdd.add(5);
    digitsToAdd.add(3);
  }
  if (selectedDigits.includes(9)) {
    digitsToAdd.add(5);
    digitsToAdd.add(4);
  }

  selectedDigits = Array.from(digitsToAdd).sort((a, b) => a - b);

  // === ПАРАМЕТРЫ БЛОКА "ПРОСТО" ===
  const onlyFiveSelected = (selectedDigits.length === 1 && selectedDigits[0] === 5);
  const onlyAddition = blocks?.simple?.onlyAddition ?? false;
  const onlySubtraction = blocks?.simple?.onlySubtraction ?? false;

  // === ПАРАМЕТРЫ ДЕЙСТВИЙ ===
  const minSteps = actions?.min ?? 2;
  const maxSteps = actions?.max ?? 4;

  // === ФЛАГИ АКТИВАЦИИ БЛОКОВ (для будущей реализации) ===
  // Братья (переход через 5): 4+2, 6-2, 7+3, 9-3 и т.д.
  const brothersActive = blocks?.brothers?.active ?? false;

  // Друзья (переход через 10): 8+3, 12-4, 17+5 и т.д.
  const friendsActive = blocks?.friends?.active ?? false;

  // Микс (комбинация братьев и друзей): 14+7, 23-8 и т.д.
  const mixActive = blocks?.mix?.active ?? false;

  // Включить цифру 5 в базовые операции
  const includeFive = blocks?.simple?.includeFive ?? selectedDigits.includes(5);

  // === ОПРЕДЕЛЕНИЕ НЕОБХОДИМОСТИ БЛОКОВ ===
  // Для цифр 6-9: блоки НЕ обязательны (генерируем как одно действие)
  // Для цифр 1-5: блоки НЕ нужны вообще
  // TODO: Когда реализуем Братьев/Друзей, здесь будет другая логика
  const requireBlock = false;

  // === ФОРМИРОВАНИЕ КОНФИГУРАЦИИ ПРАВИЛА ===
  const config = {
    // Основные параметры
    digitCount,                           // Количество разрядов (1, 2, 3, ..., 9)
    combineLevels: combineLevels ?? false, // Комбинировать разряды в примерах

    // Параметры шагов
    minSteps,
    maxSteps,

    // Выбранные цифры
    selectedDigits,
    onlyFiveSelected,
    includeFive,

    // Ограничения направления
    onlyAddition,
    onlySubtraction,

    // Блоки правил (активация)
    requireBlock,
    brothersActive,   // Братья: переход через 5
    friendsActive,    // Друзья: переход через 10
    mixActive,        // Микс: комбинация братьев и друзей

    // Полная структура блоков (для будущего расширения)
    blocks: settings.blocks,

    // Параметры действий (для будущего)
    actions: settings.actions
  };

  // === ВЫБОР ПРАВИЛА НА ОСНОВЕ ВЫБРАННЫХ ЦИФР ===
  // Проверяем, какие цифры выбраны в оригинальном выборе пользователя
  const originalDigits = (blocks?.simple?.digits?.length > 0)
    ? blocks.simple.digits.map(d => parseInt(d, 10))
    : [1, 2, 3, 4];

  const has5 = selectedDigits.includes(5);
  const has9 = originalDigits.includes(9);
  const has8 = originalDigits.includes(8);
  const has7 = originalDigits.includes(7);
  const has6 = originalDigits.includes(6);

  // Приоритет выбора правила: 9 > 8 > 7 > 6 > UnifiedSimple
  // Для цифр 6-9 требуется цифра 5 (верхняя косточка)

  if (has9 && has5) {
    console.log(`✅ Правило создано: Просто 9 (цифры: [${selectedDigits.join(', ')}], digitCount=${digitCount})`);
    return new Simple9Rule(config);
  }

  if (has8 && has5) {
    console.log(`✅ Правило создано: Просто 8 (цифры: [${selectedDigits.join(', ')}], digitCount=${digitCount})`);
    return new Simple8Rule(config);
  }

  if (has7 && has5) {
    console.log(`✅ Правило создано: Просто 7 (цифры: [${selectedDigits.join(', ')}], digitCount=${digitCount})`);
    return new Simple7Rule(config);
  }

  if (has6 && has5) {
    console.log(`✅ Правило создано: Просто 6 (цифры: [${selectedDigits.join(', ')}], digitCount=${digitCount})`);
    return new Simple6Rule(config);
  }

  // По умолчанию используем UnifiedSimpleRule (цифры 1-5)
  console.log(`✅ Правило создано: Просто (цифры: [${selectedDigits.join(', ')}], digitCount=${digitCount})`);
  return new UnifiedSimpleRule(config);
}
