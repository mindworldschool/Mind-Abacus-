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

  // Получаем количество разрядов из settings.digits (1=однозначные, 2=двузначные и т.д.)
  const digitCount = parseInt(digits, 10) || 1;

  let selectedDigits = (blocks?.simple?.digits?.length > 0)
    ? blocks.simple.digits.map(d => parseInt(d, 10))
    : [1, 2, 3, 4];

  // === АВТОМАТИЧЕСКОЕ ДОБАВЛЕНИЕ НЕОБХОДИМЫХ ЦИФР ===
  // Для работы с цифрами 6-9 нужны базовые компоненты
  const digitsToAdd = new Set(selectedDigits);

  if (selectedDigits.includes(6)) {
    digitsToAdd.add(5); // 6 = 5 + 1
    digitsToAdd.add(1);
  }
  if (selectedDigits.includes(7)) {
    digitsToAdd.add(5); // 7 = 5 + 2
    digitsToAdd.add(2);
  }
  if (selectedDigits.includes(8)) {
    digitsToAdd.add(5); // 8 = 5 + 3
    digitsToAdd.add(3);
  }
  if (selectedDigits.includes(9)) {
    digitsToAdd.add(5); // 9 = 5 + 4
    digitsToAdd.add(4);
  }

  selectedDigits = Array.from(digitsToAdd).sort((a, b) => a - b);

  const onlyFiveSelected = (selectedDigits.length === 1 && selectedDigits[0] === 5);
  const onlyAddition = blocks?.simple?.onlyAddition || false;
  const onlySubtraction = blocks?.simple?.onlySubtraction || false;
  const minSteps = actions?.min ?? 2;
  const maxSteps = actions?.max ?? 4;

  // === ОПРЕДЕЛЕНИЕ НЕОБХОДИМОСТИ БЛОКОВ ===
  // Для цифр 6-9: блоки НЕ обязательны (генерируем как одно действие)
  // Для цифр 1-5: блоки НЕ нужны вообще
  const requireBlock = false;

  const config = {
    minSteps,
    maxSteps,
    selectedDigits,
    onlyFiveSelected,
    onlyAddition,
    onlySubtraction,
    requireBlock,
    digitCount,                    // Количество разрядов (1, 2, 3, ...)
    combineLevels: combineLevels || false  // Комбинировать разряды
  };

  // === ВЫБОР ПРАВИЛА НА ОСНОВЕ ВЫБРАННЫХ ЦИФР ===

  // Проверяем, какие цифры выбраны (в оригинальном выборе пользователя)
  const originalDigits = (blocks?.simple?.digits?.length > 0)
    ? blocks.simple.digits.map(d => parseInt(d, 10))
    : [1, 2, 3, 4];

  const has5 = selectedDigits.includes(5);
  const has9 = originalDigits.includes(9);
  const has8 = originalDigits.includes(8);
  const has7 = originalDigits.includes(7);
  const has6 = originalDigits.includes(6);

  // Приоритет: 9 > 8 > 7 > 6 > 5 > обычное "Просто"

  if (has9 && has5) {
    console.log(`✅ Правило создано: Просто 9 (цифры: [${selectedDigits.join(', ')}])`);
    return new Simple9Rule(config);
  }

  if (has8 && has5) {
    console.log(`✅ Правило создано: Просто 8 (цифры: [${selectedDigits.join(', ')}])`);
    return new Simple8Rule(config);
  }

  if (has7 && has5) {
    console.log(`✅ Правило создано: Просто 7 (цифры: [${selectedDigits.join(', ')}])`);
    return new Simple7Rule(config);
  }

  if (has6 && has5) {
    console.log(`✅ Правило создано: Просто 6 (цифры: [${selectedDigits.join(', ')}])`);
    return new Simple6Rule(config);
  }

  // Если только 5 или 1-5 выбраны, используем UnifiedSimpleRule
  console.log(`✅ Правило создано: Просто (цифры: [${selectedDigits.join(', ')}])`);
  return new UnifiedSimpleRule(config);
}
