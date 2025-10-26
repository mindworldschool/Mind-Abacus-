// ext/core/generator.js
import { ExampleGenerator } from './ExampleGenerator.js';
import { UnifiedSimpleRule } from './rules/UnifiedSimpleRule.js';
import { Simple6Rule } from './rules/Simple6Rule.js';
import { Simple7Rule } from './rules/Simple7Rule.js';
import { Simple8Rule } from './rules/Simple8Rule.js';
import { Simple9Rule } from './rules/Simple9Rule.js';

/**
 * Публичная точка входа: сгенерировать пример и вернуть в формате,
 * который понимает тренажёр (steps[], answer, meta...).
 */
export function generateExample(settings) {
  const rule = createRuleFromSettings(settings);
  const generator = new ExampleGenerator(rule);
  const example = generator.generate();
  return generator.toTrainerFormat(example);
}

/**
 * Берёт настройки из UI (trainer_logic -> generatorSettings),
 * приводит их к единому ruleConfig и выбирает нужное правило.
 */
function createRuleFromSettings(settings) {
  const { blocks, actions, digits, combineLevels } = settings || {};

  //
  // 1. РАЗРЯДНОСТЬ
  //
  // digits приходит строкой "1","2","3"... → делаем число.
  const digitCount = parseInt(digits, 10) || 1;

  //
  // 2. ИСХОДНЫЙ ВЫБОР ЦИФР ПОЛЬЗОВАТЕЛЯ
  //
  // Пользователь может выбрать только некоторые цифры (на экране "Просто"):
  // например [1,2,3,4] или [5] или [7] и т.д.
  //
  const originalDigits = (blocks?.simple?.digits?.length > 0)
    ? blocks.simple.digits.map(d => parseInt(d, 10))
    : [1, 2, 3, 4];

  //
  // 3. ДОПОЛНЕНИЕ ЦИФР ДЛЯ КОМПОЗИТНЫХ ЧИСЕЛ 6..9
  //
  // Если выбрана, например, 7 — нам нужны ходы с 5 и 2.
  // Мы расширяем набор допустимых шагов, чтобы правило знало, чем вообще можно оперировать.
  //
  let selectedDigits = [...originalDigits];
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

  //
  // 4. ФЛАГИ ДЛЯ "ПРОСТО"
  //
  // onlyFiveSelected:
  //   ребёнок тренирует только пятёрку (особый случай "только верхняя косточка")
  //   это ДОЛЖНО считаться по изначальному выбору пользователя, а не после расширения.
  //
  const onlyFiveSelected =
    (originalDigits.length === 1 && originalDigits[0] === 5);

  // Разрешено ли использовать пятёрку как отдельную косточку (верхнюю)?
  // Это определяет режим "Просто 4" (includeFive=false) vs "Просто 5" (includeFive=true).
  // Логика:
  //  - если UI прислал blocks.simple.includeFive → используем это,
  //  - иначе считаем, что если среди цифр есть 5, то пятёрку можно.
  //
  const includeFive =
    (blocks?.simple?.includeFive ?? selectedDigits.includes(5));

  // Ограничение направления: только сложение / только вычитание.
  const onlyAddition     = blocks?.simple?.onlyAddition     ?? false;
  const onlySubtraction  = blocks?.simple?.onlySubtraction  ?? false;

  //
  // 5. КОЛИЧЕСТВО ШАГОВ В ПРИМЕРЕ
  //
  const minSteps = actions?.min ?? 2;
  const maxSteps = actions?.max ?? 4;

  //
  // 6. АКТИВНЫЕ МЕТОДИЧЕСКИЕ БЛОКИ
  //
  // Эти флаги нам понадобятся в следующих этапах:
  //  - brothersActive: отработка "брат 5" (+5 -1 и т.д.)
  //  - friendsActive: отработка друзей (5+2, 5+3 и т.п. для 7/8/9)
  //  - mixActive: комбинированная тренировка (обязать пример содержать оба типа паттернов)
  //
  const brothersActive = blocks?.brothers?.active ?? false;
  const friendsActive  = blocks?.friends?.active  ?? false;
  const mixActive      = blocks?.mix?.active      ?? false;

  //
  // 7. REQUIRE BLOCK (будущее поведение)
  //
  // В перспективе: если, скажем, включён brothersActive,
  // мы будем требовать, чтобы в каждом примере был блок вида [+5, -1].
  // Пока это не жёстко включено => false.
  //
  const requireBlock = false;

  //
  // 8. СБОРКА CONFIG ДЛЯ ПРАВИЛА
  //
  // Это то, что попадёт в UnifiedSimpleRule / Simple6Rule / ...,
  // и дальше в ExampleGenerator.
  //
  const ruleConfig = {
    // Разрядность
    digitCount,                            // сколько разрядов мы тренируем (1..9)
    combineLevels: combineLevels ?? false, // разрешаем использовать сразу несколько разрядов внутри шага

    // Длина примера
    minSteps,
    maxSteps,

    // Цифры и разрешённые дельты
    selectedDigits,
    onlyFiveSelected,
    includeFive,

    // Направление действий
    onlyAddition,
    onlySubtraction,

    // Обучающие блоки
    requireBlock,
    brothersActive,
    friendsActive,
    mixActive,

    // Полная структура блоков и действий (нужно для следующих этапов,
    // и чтобы правило могло проанализировать настройки глубже)
    blocks,
    actions
  };

  //
  // 9. ВЫБОР КОНКРЕТНОГО ПРАВИЛА
  //
  // Здесь мы определяем, какое правило использовать.
  // Логика:
  //   - если пользователь явно выбрал цифры 9/8/7/6
  //     (в исходном выборе originalDigits), и при этом пятёрка разрешена,
  //     то мы берём спец-правило (Simple9Rule и т.д.).
  //   - иначе берём UnifiedSimpleRule (базовая "Просто").
  //
  const has5 = selectedDigits.includes(5);
  const has9 = originalDigits.includes(9);
  const has8 = originalDigits.includes(8);
  const has7 = originalDigits.includes(7);
  const has6 = originalDigits.includes(6);

  // Правила "Просто 9", "Просто 8", ... требуют уметь работать с пятёркой
  // (верхняя косточка должна быть включена).
  if (has9 && has5) {
    console.log(
      `✅ Правило создано: Просто 9 | digits=[${selectedDigits.join(', ')}] | digitCount=${digitCount}`
    );
    return new Simple9Rule(ruleConfig);
  }

  if (has8 && has5) {
    console.log(
      `✅ Правило создано: Просто 8 | digits=[${selectedDigits.join(', ')}] | digitCount=${digitCount}`
    );
    return new Simple8Rule(ruleConfig);
  }

  if (has7 && has5) {
    console.log(
      `✅ Правило создано: Просто 7 | digits=[${selectedDigits.join(', ')}] | digitCount=${digitCount}`
    );
    return new Simple7Rule(ruleConfig);
  }

  if (has6 && has5) {
    console.log(
      `✅ Правило создано: Просто 6 | digits=[${selectedDigits.join(', ')}] | digitCount=${digitCount}`
    );
    return new Simple6Rule(ruleConfig);
  }

  // Базовое правило "Просто" (1..5)
  console.log(
    `✅ Правило создано: Просто | digits=[${selectedDigits.join(', ')}] | digitCount=${digitCount} | includeFive=${includeFive}`
  );
  return new UnifiedSimpleRule(ruleConfig);
}
