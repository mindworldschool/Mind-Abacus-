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

  // 2. Шаги (кол-во действий в одном примере)
  //
  // Если включён "бесконечный" режим (actions.infinite === true),
  // мы не жёстко фиксируем длину; иначе count управляет мин/макс.
  const minStepsRaw = actionsCfg.infinite
    ? 2
    : (actionsCfg.min ?? actionsCfg.count ?? 2);
  const maxStepsRaw = actionsCfg.infinite
    ? 12
    : (actionsCfg.max ?? actionsCfg.count ?? 4);

  // Для многозначных примеров без combineLevels (то есть каждый разряд генерится отдельно,
  // но показываем как общий шаг), длинные цепочки сложнее подобрать,
  // поэтому мы мягко ограничиваем длину, чтобы генератор не застревал.
  let minSteps = minStepsRaw;
  let maxSteps = maxStepsRaw;
  if (digitCount > 1 && !combineLevels) {
    minSteps = Math.min(minStepsRaw, 4);
    maxSteps = Math.min(maxStepsRaw, 4);
  }

  // 3. Блок "Просто" — какие абсолютные дельты (+N / -N) разрешены ребёнку
  //
  // Это КРИТИЧЕСКО.
  //
  // Раньше мы делали "магическое расширение" выбранных цифр:
  //   7 -> добавь 5 и 2, 9 -> добавь 5 и 4, ...
  // потому что генератор не умел сразу давать +7.
  //
  // ТЕПЕРЬ ЭТО НЕ НУЖНО.
  //
  // После нашей правки UnifiedSimpleRule.getAvailableActions():
  // - шаги типа +6, +7, +8, +9 возвращаются напрямую как один жест,
  //   но ТОЛЬКО если такие дельты вообще разрешены пользователем.
  //
  // Значит:
  //   selectedDigits = РОВНО те цифры, что выбрал пользователь в блоке «Просто».
  //
  // Никакого автодобавления 5+2 ради семёрки. Если семёрка не выбрана — не тренируем 7.
  //
  const originalDigits = Array.isArray(blocks?.simple?.digits)
    ? blocks.simple.digits
        .map(n => parseInt(n, 10))
        .filter(n => !Number.isNaN(n))
    : [1, 2, 3, 4];

  // Уникализируем и сортируем на всякий.
  const selectedDigits = Array.from(new Set(originalDigits)).sort((a, b) => a - b);

  // 4. includeFive управляет режимом "Просто 4" vs "Просто 5"
  //
  // Смысл:
  //  - Если includeFive=false, то верхняя косточка "5" методически выключена.
  //    Значит из getAvailableActions() будут вырезаны любые шаги с модулем 5.
  //
  // Приоритет источника:
  //   1) blocks.simple.includeFive
  //   2) settings.includeFive
  //   3) сам факт, что среди выбранных цифр есть 5
  //
  const includeFive =
    (blocks?.simple?.includeFive ??
      settings.includeFive ??
      selectedDigits.includes(5)) === true;

  // 5. Только сложение / только вычитание
  const onlyAddition =
    (blocks?.simple?.onlyAddition ?? settings.onlyAddition ?? false) === true;

  const onlySubtraction =
    (blocks?.simple?.onlySubtraction ??
      settings.onlySubtraction ??
      false) === true;

  // 6. Спец-блоки методики (позже будут свои правила)
  const brothersActive = blocks?.brothers?.active === true;
  const friendsActive = blocks?.friends?.active === true;
  const mixActive = blocks?.mix?.active === true;

  // 7. Собираем ruleConfig
  //
  // Это то, что уйдёт в UnifiedSimpleRule.
  // UnifiedSimpleRule теперь:
  //  - использует selectedDigits как "разрешённые абсолютные дельты"
  //    (например, если [1,2,7,9], то шаги могут быть +1, -2, +7, -9 и т.д., если физически достижимо),
  //  - учитывает includeFive (можно ли вообще использовать пятёрку),
  //  - учитывает onlyAddition / onlySubtraction,
  //  - знает digitCount и combineLevels,
  //  - применяет правило "первый шаг не может быть минусом".
  //
  const ruleConfig = {
    // структура абакуса / примера
    digitCount: digitCount,          // 1..9
    combineLevels: combineLevels,    // true = комбинированный шаг по всем разрядам сразу

    // длина примера
    minSteps: minSteps,
    maxSteps: maxSteps,

    // разрешённые абсолютные величины шагов для ребёнка
    selectedDigits: selectedDigits,

    // режим Просто 4 / Просто 5
    includeFive: includeFive,
    hasFive: includeFive, // алиас для старой логики

    // ограничение направления
    onlyAddition: onlyAddition,
    onlySubtraction: onlySubtraction,

    // "блоки методики" (позже будем разветвлять на отдельные правила)
    brothersActive: brothersActive,
    friendsActive: friendsActive,
    mixActive: mixActive,

    // методические требования
    firstActionMustBePositive: true,

    // обязательные формулы (ещё не включаем)
    requireBlock: false,
    blockPlacement: "auto",

    // исходные блоки целиком, чтобы правило могло смотреть в настройки
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

  // 8. Выбор правила
  //
  // Сейчас всегда UnifiedSimpleRule.
  // В будущем:
  //  - brothersActive → BrothersRule
  //  - friendsActive  → FriendsRule
  //  - mixActive      → случайный выбор
  //
  const rule = new UnifiedSimpleRule(ruleConfig);

  // 9. Генерируем пример через ExampleGenerator
  const gen = new ExampleGenerator(rule);
  const rawExample = gen.generate();

  // 10. Преобразуем к формату, который показывает тренажёр
  const formatted = gen.toTrainerFormat(rawExample);

  console.log(
    "✅ [generator] пример готов:",
    JSON.stringify(formatted, null, 2)
  );

  return formatted;
}
