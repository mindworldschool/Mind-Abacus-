// ext/core/generator.js
import { ExampleGenerator } from './ExampleGenerator.js';
import { UnifiedSimpleRule } from './rules/UnifiedSimpleRule.js';

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
  const minSteps = actions?.min ?? 2;
  const maxSteps = actions?.max ?? 4;

  const config = {
    minSteps,
    maxSteps,
    selectedDigits,
    onlyFiveSelected
  };

  console.log(`✅ Правило создано для цифр: [${selectedDigits.join(', ')}]`);
  return new UnifiedSimpleRule(config);
}
