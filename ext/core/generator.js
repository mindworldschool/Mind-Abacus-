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
  const { blocks, actions } = settings;

  const selectedDigits = (blocks?.simple?.digits?.length > 0)
    ? blocks.simple.digits.map(d => parseInt(d, 10))
    : [1, 2, 3, 4];

  const onlyFiveSelected = (selectedDigits.length === 1 && selectedDigits[0] === 5);
  const onlyAddition = blocks?.simple?.onlyAddition || false;
  const onlySubtraction = blocks?.simple?.onlySubtraction || false;
  const minSteps = actions?.min ?? 2;
  const maxSteps = actions?.max ?? 4;

  const config = {
    minSteps,
    maxSteps,
    selectedDigits,
    onlyFiveSelected,
    onlyAddition,
    onlySubtraction,
    requireBlock: true // По умолчанию требуем блок ±k
  };

  // === ВЫБОР ПРАВИЛА НА ОСНОВЕ ВЫБРАННЫХ ЦИФР ===

  // Проверяем, какие цифры выбраны
  const has5 = selectedDigits.includes(5);
  const has9 = selectedDigits.includes(9);
  const has8 = selectedDigits.includes(8);
  const has7 = selectedDigits.includes(7);
  const has6 = selectedDigits.includes(6);

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
