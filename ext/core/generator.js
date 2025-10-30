// ext/core/generator.js
//
// Генератор примеров для тренажёра.
// Отвечает за:
//  - чтение настроек из UI,
//  - подготовку конфигурации правила,
//  - вызов ExampleGenerator,
//  - адаптацию результата под формат тренажёра.
//
// Работает сейчас в первую очередь для режима "Просто":
//   - последовательные шаги вида +3, +1, -4 ...
//   - без "братьев", "друзей", "через 5"
//   - без переноса между столбцами (каждый столбец живёт сам по себе)
//
// Зависимости:
//  - UnifiedSimpleRule — описывает допустимые шаги (+N / -N), физику абакуса,
//    учитывает includeFive (Просто 4 / Просто 5), запрет первого минуса и т.д.
//  - ExampleGenerator — строит саму цепочку шагов, опираясь на правило

import { UnifiedSimpleRule } from "./rules/UnifiedSimpleRule.js";
import { ExampleGenerator } from "./ExampleGenerator.js";
import { BrothersRule } from "./rules/BrothersRule.js";

/**
 * Основная внешняя функция.
 * Вызывается из trainer_logic.js при показе каждого нового примера.
 *
 * @param {Object} settings - настройки из UI
 * @returns {{ start:number, steps:string[], answer:number }}
 *          Пример в готовом формате для тренажёра.
 */
export function generateExample(settings = {}) {
  console.log("🧠 [generator] входные настройки:", settings);

  //
  // 1. Разрядность
  //
  // digits = сколько столбцов абакуса мы тренируем одновременно.
  // Для классического "Просто" это 1.
  //
  const digitCountRaw = parseInt(settings.digits, 10);
  const digitCount =
    Number.isFinite(digitCountRaw) && digitCountRaw > 0
      ? digitCountRaw
      : 1;

  // combineLevels:
  // true  → один шаг двигает все разряды сразу (общий вектор),
  // false → более строго (каждый столбец сам по себе).
  const combineLevels = settings.combineLevels === true;

  //
  // 2. Длина примера (сколько шагов в последовательности)
  //
  // settings.actions управляет количеством шагов:
  //   - count: фиксированная длина
  //   - min / max: диапазон
  //   - infinite: "игра бесконечно", тогда мы просто берём разумный коридор
  //
  const actionsCfg = settings.actions || {};
  const minStepsRaw = actionsCfg.infinite
    ? 2
    : (actionsCfg.min ?? actionsCfg.count ?? 2);
  const maxStepsRaw = actionsCfg.infinite
    ? 12
    : (actionsCfg.max ?? actionsCfg.count ?? 4);

  let minSteps = minStepsRaw;
  let maxSteps = maxStepsRaw;

  // Если много разрядов и это не объединённый жест,
  // слишком длинные примеры тяжело сгенерировать без тупика → мягко режем.
  if (digitCount > 1 && !combineLevels) {
    minSteps = Math.min(minSteps, 4);
    maxSteps = Math.min(maxSteps, 4);
  }

  //
  // 3. Какие цифры разрешены ребёнку в блоке "Просто"
  //
  // Это КЛЮЧЕВО.
  //
  // Мы больше НЕ раскладываем большие числа "7 = 5+2".
  // Сейчас каждое действие в примере — это сразу ±d,
  // и d должен В ПРЯМУЮ входить в выбранный список.
  //
  // Примеры:
  //   digits=[3]          → можно +3, -3
  //   digits=[2,5,7]      → можно +2,-2,+5,-5,+7,-7
  //   digits=[1..9]       → полная свобода
  //
  const blocks = settings.blocks || {};
  const originalDigits = Array.isArray(blocks?.simple?.digits)
    ? blocks.simple.digits
        .map(n => parseInt(n, 10))
        .filter(n => Number.isFinite(n))
    : [1, 2, 3, 4]; // дефолт если UI не прислал ничего

  // Уникализируем и сортируем для стабильности
  const selectedDigits = Array.from(new Set(originalDigits)).sort(
    (a, b) => a - b
  );

  //
  // 4. includeFive — методический флаг.
  //
  // Если includeFive === false:
  //   - нельзя использовать верхнюю бусину,
  //   - стойка живёт в диапазоне 0..4,
  //   - мы не генерируем дельту ±5.
  //
  // Если includeFive === true:
  //   - можно использовать верхнюю бусину,
  //   - стойка живёт в диапазоне 0..9,
  //   - возможны ходы с верхней.
  //
  const includeFive =
    (blocks?.simple?.includeFive ??
      settings.includeFive ??
      selectedDigits.includes(5)) === true;

  //
  // 5. Ограничения направления:
  //    onlyAddition = "тренируем только сложение"
  //    onlySubtraction = "тренируем только вычитание"
  //
  const onlyAddition =
    (blocks?.simple?.onlyAddition ??
      settings.onlyAddition ??
      false) === true;
  const onlySubtraction =
    (blocks?.simple?.onlySubtraction ??
      settings.onlySubtraction ??
      false) === true;

  //
  // 6. Флаги будущих методик (они пока не переключают правило,
  // но мы их прокидываем в конфиг, чтобы не порвать остальной код).
  //
  const brothersActive = blocks?.brothers?.active === true;
  const friendsActive = blocks?.friends?.active === true;
  const mixActive = blocks?.mix?.active === true;

  //
  // 7. Собираем конфигурацию для UnifiedSimpleRule.
  //
  // UnifiedSimpleRule:
  //   - считает доступные ходы с текущего состояния (getAvailableActions),
  //     с учётом физики стоек и includeFive;
  //   - следит, чтобы нельзя было сделать невозможный жест
  //     (например +4 из состояния 4 без верхней бусины);
  //   - запрещает первый шаг с минусом;
  //   - не даёт выйти за методический диапазон (0..4 или 0..9);
  //   - валидирует конечный ответ.
  //
  const ruleConfig = {
    // структура числа
    digitCount: digitCount,
    combineLevels: combineLevels,

    // желаемая длина примера
    minSteps: minSteps,
    maxSteps: maxSteps,

    // какие абсолютные шаги вообще можно давать ребёнку (+d / -d)
    selectedDigits: selectedDigits,

    // доступ к верхней бусине (формирует режим "Просто 4" vs "Просто 5")
    includeFive: includeFive,
    hasFive: includeFive, // совместимость со старым кодом

    // ограничения направления
    onlyAddition: onlyAddition,
    onlySubtraction: onlySubtraction,

    // будущие режимы
    brothersActive: brothersActive,
    friendsActive: friendsActive,
    mixActive: mixActive,

    // методическое правило блока "Просто":
    firstActionMustBePositive: true,

    // эти два поля сейчас не используются в "Просто",
    // но оставляем, чтобы внешний код не падал
    requireBlock: false,
    blockPlacement: "auto",

    // передаём исходный блок настроек целиком (UI),
    // чтобы правило при желании могло подсмотреть детали
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

  //
  // 8. Создаём правило.
  //
  // UnifiedSimpleRule обязан реализовать:
  //  - generateStartState()  → стартовое состояние (0 или [0,0,...])
  //  - generateStepsCount()  → количество шагов
  //  - getAvailableActions() → допустимые локальные шаги с текущей стойки
  //  - applyAction()         → применить шаг
  //  - validateExample()     → проверить готовый пример
  //
  let rule;

// если активирован блок "Братья" — используем BrothersRule
if (ruleConfig.brothersActive === true) {
  console.log("🎯 [generator] Режим БРАТЬЯ активирован");
  console.log("   Выбранные братья:", ruleConfig.blocks?.brothers?.digits);
  
  rule = new BrothersRule({
    selectedDigits: ruleConfig.blocks?.brothers?.digits || [4],
    onlyAddition: ruleConfig.blocks?.brothers?.onlyAddition ?? false,
    onlySubtraction: ruleConfig.blocks?.brothers?.onlySubtraction ?? false,
    minSteps: ruleConfig.minSteps,
    maxSteps: ruleConfig.maxSteps,
    digitCount: ruleConfig.digitCount,
    combineLevels: ruleConfig.combineLevels,
    blocks: ruleConfig.blocks,
  });
} else {
  console.log("🎯 [generator] Режим ПРОСТО");
  rule = new UnifiedSimpleRule(ruleConfig);
}
  
  //
  // 9. Генерируем пример.
  //
  const gen = new ExampleGenerator(rule);
  const rawExample = gen.generate(); // { start, steps:[{action,fromState,toState}], answer }

  //
  // 10. Преобразуем к формату, который ждёт UI/trainer_logic:
  // {
  //    start: 0,
  //    steps: ["+3","+1","-4", ...],
  //    answer: 0
  // }
  //
  const formatted = gen.toTrainerFormat(rawExample);

  console.log(
    "✅ [generator] пример готов:",
    JSON.stringify(formatted, null, 2)
  );

  return formatted;
}
