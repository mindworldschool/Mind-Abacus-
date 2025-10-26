// ext/core/generator.js
//
// Генератор примеров для тренажёра.
// Отвечает за:
//  - чтение настроек из UI,
//  - подготовку конфигурации правил,
//  - выбор правильного правила,
//  - вызов ExampleGenerator и адаптацию результата под trainer_logic.js.
//
// Зависимости:
//  - UnifiedSimpleRule (базовая логика "Просто"),
//  - ExampleGenerator (строит последовательности шагов по правилу).

import { UnifiedSimpleRule } from "./rules/UnifiedSimpleRule.js";
import { ExampleGenerator } from "./ExampleGenerator.js";

/**
 * Основная внешняя функция.
 * Вызывается из trainer_logic.js при показе каждого нового примера.
 * @param {Object} settings - настройки, пришедшие из UI
 * @returns {Object} { start:number, steps:string[], answer:number }
 *          в формате, который trainer_logic.js уже умеет показывать
 */
export function generateExample(settings = {}) {
  console.log("🧠 [generator] входные настройки:", settings);

  // 1. Считываем ключевые параметры тренировки
  const digitCount = parseInt(settings.digits, 10) || 1; // разрядность: 1..9
  const combineLevels = settings.combineLevels === true; // true -> многоразрядный шаг сразу по всем разрядам
  const actionsCfg = settings.actions || {};
  const blocks = settings.blocks || {};

  // Ограничение по количеству шагов (действий):
  //  - если режим "бесконечно" не включён, то actions.count задаёт и min, и max
  const minStepsRaw = actionsCfg.infinite
    ? 2
    : (actionsCfg.min ?? actionsCfg.count ?? 2);
  const maxStepsRaw = actionsCfg.infinite
    ? 12
    : (actionsCfg.max ?? actionsCfg.count ?? 4);

  // Для многозначных примеров без комбинированного шага (combineLevels=false)
  // генератору всё ещё тяжело строить очень длинные цепочки.
  // Чтобы не сыпаться в "300 попыток не удалось", мы подрежем длину.
  let minSteps = minStepsRaw;
  let maxSteps = maxStepsRaw;
  if (digitCount > 1 && !combineLevels) {
    minSteps = Math.min(minStepsRaw, 4);
    maxSteps = Math.min(maxStepsRaw, 4);
  }

  // 2. Читаем блок "Просто" (основные цифры, которые можно использовать)
  //    Пример: [1,2,3,4,5] или [1,2,3] и т.д.
  const originalDigits = Array.isArray(blocks?.simple?.digits)
    ? blocks.simple.digits
        .map(n => parseInt(n, 10))
        .filter(n => !Number.isNaN(n))
    : [1, 2, 3, 4];

  // includeFive управляет режимом "Просто 4" vs "Просто 5"
  // приоритет:
  //  1) settings.blocks.simple.includeFive,
  //  2) settings.includeFive,
  //  3) сам факт, что среди выбранных цифр есть 5
  const includeFive =
    (blocks?.simple?.includeFive ??
      settings.includeFive ??
      originalDigits.includes(5)) === true;

  // Только сложение / только вычитание (ограничение направления)
  const onlyAddition =
    (blocks?.simple?.onlyAddition ?? settings.onlyAddition ?? false) === true;
  const onlySubtraction =
    (blocks?.simple?.onlySubtraction ??
      settings.onlySubtraction ??
      false) === true;

  // Спец-блоки (методические формулы)
  const brothersActive = blocks?.brothers?.active === true;
  const friendsActive = blocks?.friends?.active === true;
  const mixActive = blocks?.mix?.active === true;

  // 3. Готовим final selectedDigits
  //
  // Логика:
  //  - Если digitCount === 1 (один разряд), и выбраны числа 6,7,8,9,
  //    нам нужно автоматически добавить составляющие этих чисел
  //    (7 => 5 и 2, 9 => 5 и 4 и т.д.), чтобы правило умело строить эти шаги.
  //
  //  - Если digitCount > 1 (многозначные числа),
  //    мы НИЧЕГО не расширяем. Берём ТОЛЬКО то, что реально выбрал пользователь.
  //
  let selectedDigits = [...originalDigits];

  if (digitCount === 1) {
    const digitsToAdd = new Set(selectedDigits);

    // 6 = 5+1
    if (selectedDigits.includes(6)) {
      digitsToAdd.add(5);
      digitsToAdd.add(1);
    }

    // 7 = 5+2
    if (selectedDigits.includes(7)) {
      digitsToAdd.add(5);
      digitsToAdd.add(2);
    }

    // 8 = 5+3
    if (selectedDigits.includes(8)) {
      digitsToAdd.add(5);
      digitsToAdd.add(3);
    }

    // 9 = 5+4
    if (selectedDigits.includes(9)) {
      digitsToAdd.add(5);
      digitsToAdd.add(4);
    }

    selectedDigits = Array.from(digitsToAdd).sort((a, b) => a - b);
  } else {
    console.log(
      `ℹ️ [generator] Многозначный режим (${digitCount}-разрядные): используем только выбранные цифры [${selectedDigits.join(
        ", "
      )}]`
    );
  }

  // 4. Сконструируем ruleConfig
  //
  // Этот объект мы передаём в UnifiedSimpleRule.
  // Он описывает ВСЮ методику примера.
  //
  const ruleConfig = {
    // --- структура соробана / примеров ---
    digitCount: digitCount,          // 1..9
    combineLevels: combineLevels,    // если true — шаг может менять сразу все разряды

    // --- длина примера ---
    minSteps: minSteps,
    maxSteps: maxSteps,

    // --- доступные шаги (цифры из блока Просто) ---
    selectedDigits: selectedDigits,

    // --- режим Просто 4 / Просто 5 ---
    includeFive: includeFive,
    hasFive: includeFive, // для совместимости с существующей логикой

    // --- направление (если в UI включили "только плюс" или "только минус") ---
    onlyAddition: onlyAddition,
    onlySubtraction: onlySubtraction,

    // --- блоки методик (братья / друзья / микс) ---
    brothersActive: brothersActive,
    friendsActive: friendsActive,
    mixActive: mixActive,

    // --- прочие поля, которые сейчас используют правило/генератор ---
    firstActionMustBePositive: true,

    // флаги для блоков с "обязательным вставлением формулы"
    // пока неактивно по умолчанию, но оставляем, чтобы не поломать старый код
    requireBlock: false,
    blockPlacement: "auto",

    // исходные блоки — пробрасываем на всякий случай, чтобы правило могло посмотреть
    blocks: blocks
  };

  console.log(
    "🧩 [generator] ruleConfig:",
    JSON.stringify(
      {
        digitCount: ruleConfig.digitCount,
        combineLevels: ruleConfig.combineLevels,
        minSteps: ruleConfig.minSteps,
        maxSteps: ruleConfig.maxSteps,
        selectedDigits: ruleConfig.selectedDigits,
        includeFive: ruleConfig.includeFive,
        onlyAddition: ruleConfig.onlyAddition,
        onlySubtraction: ruleConfig.onlySubtraction,
        brothersActive: ruleConfig.brothersActive,
        friendsActive: ruleConfig.friendsActive,
        mixActive: ruleConfig.mixActive
      },
      null,
      2
    )
  );

  // 5. Выбор правила
  //
  // На будущее:
  // - если brothersActive === true → можно подключать BrothersRule
  // - если friendsActive === true → FriendsRule
  // - если mixActive === true → случайный выбор
  //
  // Пока (по твоему текущему требованию): всегда базовое правило UnifiedSimpleRule.
  //
  const rule = new UnifiedSimpleRule(ruleConfig);

  // 6. Генерируем пример через ExampleGenerator
  const gen = new ExampleGenerator(rule);
  const rawExample = gen.generate();

  // 7. Адаптируем результат к формату, который тренажёр использует в UI
  const formatted = gen.toTrainerFormat(rawExample);

  console.log(
    "✅ [generator] пример готов:",
    JSON.stringify(formatted, null, 2)
  );

  return formatted;
}
