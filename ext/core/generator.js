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
//  - UnifiedSimpleRule (логика режима "Просто"),
//  - ExampleGenerator (строит последовательности шагов по правилу).

import { UnifiedSimpleRule } from "./rules/UnifiedSimpleRule.js";
import { ExampleGenerator } from "./ExampleGenerator.js";

/**
 * Основная внешняя функция.
 * Вызывается из trainer_logic.js при показе каждого нового примера.
 *
 * @param {Object} settings - настройки из UI
 * @returns {Object} formatted example:
 *          {
 *            start: number,
 *            steps: string[], // ["+3","+1","+5","-7","+6","-8"]
 *            answer: number
 *          }
 */
export function generateExample(settings = {}) {
  console.log("🧠 [generator] входные настройки:", settings);

  // 1. Разрядность (сколько столбцов абакуса участвует)
  const digitCount = parseInt(settings.digits, 10) || 1; // 1..9
  const combineLevels = settings.combineLevels === true; // true → один общий шаг двигает все разряды

  // 2. Длина примера (кол-во шагов)
  const actionsCfg = settings.actions || {};
  const minStepsRaw = actionsCfg.infinite
    ? 2
    : (actionsCfg.min ?? actionsCfg.count ?? 2);
  const maxStepsRaw = actionsCfg.infinite
    ? 12
    : (actionsCfg.max ?? actionsCfg.count ?? 4);

  let minSteps = minStepsRaw;
  let maxSteps = maxStepsRaw;

  // Для многозначных примеров без combineLevels ограничиваем длину,
  // чтобы генератор не застревал.
  if (digitCount > 1 && !combineLevels) {
    minSteps = Math.min(minStepsRaw, 4);
    maxSteps = Math.min(maxStepsRaw, 4);
  }

  // 3. Какие цифры разрешены ребёнку в блоке "Просто"
  //    Это ТОЛЬКО те цифры, которые реально выбраны в UI.
  //    Мы больше не раскладываем 7 на (5+2) и т.д.
  //    Если [3,7] → шаги могут быть ±3 и ±7. Если [1..9] → всё.
  const blocks = settings.blocks || {};
  const originalDigits = Array.isArray(blocks?.simple?.digits)
    ? blocks.simple.digits
        .map(n => parseInt(n, 10))
        .filter(n => !Number.isNaN(n))
    : [1, 2, 3, 4];

  const selectedDigits = Array.from(new Set(originalDigits)).sort((a, b) => a - b);

  // 4. includeFive управляет тем, разрешена ли "пятёрка".
  //    Если includeFive=false → в UnifiedSimpleRule мы просто вырежем шаги с модулем 5.
  const includeFive =
    (blocks?.simple?.includeFive ??
      settings.includeFive ??
      selectedDigits.includes(5)) === true;

  // 5. Ограничения по направлению (только плюс / только минус)
  const onlyAddition =
    (blocks?.simple?.onlyAddition ?? settings.onlyAddition ?? false) === true;
  const onlySubtraction =
    (blocks?.simple?.onlySubtraction ?? settings.onlySubtraction ?? false) === true;

  // 6. Флаги будущих методик (пока не ветвим по ним правило)
  const brothersActive = blocks?.brothers?.active === true;
  const friendsActive = blocks?.friends?.active === true;
  const mixActive = blocks?.mix?.active === true;

  // 7. Готовим конфиг правила
  const ruleConfig = {
    // структура абакуса / примера
    digitCount: digitCount,
    combineLevels: combineLevels,

    // длина примера
    minSteps: minSteps,
    maxSteps: maxSteps,

    // разрешённые абсолютные величины для шага
    selectedDigits: selectedDigits,

    // режим "Просто 4" / "Просто 5"
    includeFive: includeFive,
    hasFive: includeFive, // совместимость со старым кодом

    // ограничение направления
    onlyAddition: onlyAddition,
    onlySubtraction: onlySubtraction,

    // будущие типы режимов
    brothersActive: brothersActive,
    friendsActive: friendsActive,
    mixActive: mixActive,

    // методические требования
    firstActionMustBePositive: true,

    // обязательные формулы (в этом режиме не используются)
    requireBlock: false,
    blockPlacement: "auto",

    // оригинальные блоки из настроек UI
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

  // 8. Создаём правило
  // ВАЖНО: UnifiedSimpleRule ДОЛЖЕН реализовывать:
  //    - getAvailableActions(state, isFirstAction, position?)
  //    - applyAction(state, action)
  //    - validateExample(example)
  //    - generateStepsCount()        <-- см. комментарий ниже
  //    - generateStartState()        <-- см. комментарий ниже
  //
  // generateStepsCount() должен вернуть случайную длину шага между minSteps и maxSteps.
  // generateStartState() должен вернуть 0 (или массив нулей для многозначного случая).
  //
  const rule = new UnifiedSimpleRule(ruleConfig);

  // 9. Генерируем пример через ExampleGenerator
  const gen = new ExampleGenerator(rule);
  const rawExample = gen.generate();

  // 10. Преобразуем к формату для trainer_logic.js / UI
  const formatted = gen.toTrainerFormat(rawExample);

  console.log(
    "✅ [generator] пример готов:",
    JSON.stringify(formatted, null, 2)
  );

  return formatted;
}
