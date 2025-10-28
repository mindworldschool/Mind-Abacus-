// ext/core/rules/UnifiedSimpleRule.js
//
// Унифицированное правило для тренировки "Просто" (один столбец абакуса без переноса).
//
// Главные принципы:
//
// 1. Всегда стартуем с 0 (все бусины не активны).
//    Стартовое состояние не показывается ребёнку как отдельный шаг.
//
// 2. Первый шаг ВСЕГДА положительный (+N), потому что с нуля нельзя физически начать с минуса.
//
// 3. Каждый шаг примера — это одно целое число со знаком, например +3 или -7.
//    Мы считаем это ОДНИМ жестом, ребёнок не разбирает это внутри,
//    не раскладывает +7 как "+5 потом +2". Он просто слышит/видит "+7".
//
// 4. Шаг может быть любым из разрешённых ребёнку значений по модулю (1..9),
//    но только из выбранных цифр в блоке «Просто». То есть если выбраны [2,7],
//    то разрешены только ±2 и ±7.
//
// 5. Ограничение физики абакуса: после каждого шага значение в столбце
//    должно оставаться в диапазоне 0..9. Нельзя уйти <0 или >9,
//    и мы не делаем переносы между столбцами.
//
// 6. В блоке «Просто» мы не используем формулы "через 5", "братья", "друзья 10".
//    Это другой режим.
//
// 7. includeFive:
//    - Если верхняя бусина (5) выключена методически, мы запрещаем ±5.
//    - НО очень важно: если пользователь выбирает только большие цифры
//      (6,7,8,9), то физически без верхней бусины это невозможно.
//      Значит мы должны автоматически считать, что верхняя бусина доступна,
//      даже если UI не поставил галочку. Иначе примеры с одной цифрой 6/7/8/9
//      просто не сгенерируются.
//    - Это то, что мы сейчас фиксируем.
//
// 8. Валидация примера:
//    - первый шаг должен быть плюсом;
//    - каждый промежуточный state валиден (0..9);
//    - финальный ответ — либо 0, либо разрешённая цифра,
//      если мы тренируем один разряд.


import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    //
    // 1. Какие цифры разрешены ребёнку как шаги?
    //
    //    Примеры конфигураций:
    //    [2]         → только ±2
    //    [3,5]       → ±3 и ±5
    //    [1,2,3,4,5] → классика "Просто 5"
    //    [6,7,8,9]   → должны уметь давать ±6, ±7, ±8, ±9
    //
    const selectedDigits = Array.isArray(config.selectedDigits)
      ? config.selectedDigits
      : [1, 2, 3, 4];

    //
    // 2. includeFive
    //
    // Раньше мы делали так: includeFive = (галочка includeFive ИЛИ среди выбранных цифр есть 5).
    // Это ломало сценарий "только 7". Почему?
    //
    // При [7] верхняя бусина фактически нужна (это 5 + 2 физически на стойке),
    // но 5 как отдельная цифра не выбрана, и галочка includeFive могла быть false.
    // Тогда движок думал "нельзя трогать верхнюю", и не мог сгенерировать +7.
    //
    // Фикс:
    // - Если среди выбранных цифр есть Х >= 6, значит ребёнок работает с комбинацией
    //   "верхняя бусина + нижние", то есть верхняя бусина должна быть активируема.
    //   Мы обязаны считать includeFive=true.
    //
    const maxSelected = Math.max(...selectedDigits);
    const autoNeedsUpperBead = maxSelected >= 6; // 6,7,8,9 требуют верхнюю по физике

    const includeFiveFinal =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5) ??
        false) || autoNeedsUpperBead;

    // Это имя и описание правила (для логов/отладки)
    this.name = "Просто";
    this.description =
      "Тренируем прямые плюсы и минусы на одном разряде без переноса";

    //
    // 3. Собираем итоговую конфигурацию правила
    //
    this.config = {
      // физические пределы для одного столбца абакуса
      minState: 0,
      maxState: 9, // максимум одна верхняя (5) и до четырёх нижних (1..4), всего 9

      // ограничения длины примера
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // разрешённые абсолютные значения шага
      selectedDigits,

      // статус доступности верхней бусины (см. логику выше)
      includeFive: includeFiveFinal,
      hasFive: includeFiveFinal, // alias для старого кода

      // методические требования
      // 1) старт всегда из 0
      // 2) первый шаг не может быть минусом
      firstActionMustBePositive: true,

      // многоразрядность (на будущее)
      digitCount: config.digitCount ?? 1,

      // совместимость с остальным кодом
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // на будущее
      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

      // прокидываем всё остальное на всякий случай
      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule init:
  digitsAllowed=[${selectedDigits.join(", ")}]
  maxSelected=${maxSelected}
  autoNeedsUpperBead=${autoNeedsUpperBead}
  includeFiveFinal=${includeFiveFinal}
  digitCount=${this.config.digitCount}
  minSteps=${this.config.minSteps}
  maxSteps=${this.config.maxSteps}
  onlyAddition=${this.config.onlyAddition}
  onlySubtraction=${this.config.onlySubtraction}
  firstActionMustBePositive=${this.config.firstActionMustBePositive}`
    );
  }

  /**
   * Сколько шагов надо в примере?
   * Берём случайно в диапазоне [minSteps .. maxSteps].
   */
  generateStepsCount() {
    const min = this.config.minSteps ?? 2;
    const max = this.config.maxSteps ?? min;
    if (min === max) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /**
   * Начальное состояние абакуса:
   * - один разряд → число 0;
   * - несколько разрядов → массив нулей длиной digitCount.
   */
  generateStartState() {
    const dc = this.config.digitCount ?? 1;
    if (dc === 1) return 0;
    return Array(dc).fill(0);
  }

  /**
   * Форматируем шаг для UI:
   *  +3, -7, ...
   * В многозначном случае action может быть {position,value}.
   */
  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    return action >= 0 ? `+${action}` : `${action}`;
  }

  /**
   * Получить значение одного разряда (0..9),
   * даже если текущее состояние хранится как массив.
   */
  getDigitValue(currentState, position = 0) {
    if (Array.isArray(currentState)) {
      return currentState[position] ?? 0;
    }
    return currentState ?? 0;
  }

  /**
   * Применить шаг (action) к состоянию currentState.
   * action либо число (одноразрядный режим),
   * либо {position,value} (мультиразрядный режим).
   */
  applyAction(currentState, action) {
    if (typeof action === "object" && action !== null) {
      // многоразрядный случай
      const arr = Array.isArray(currentState)
        ? [...currentState]
        : [currentState];
      const { position, value } = action;
      arr[position] = (arr[position] ?? 0) + value;
      return arr;
    } else {
      // одноразрядный случай
      const v = this.getDigitValue(currentState, 0);
      return v + action;
    }
  }

  /**
   * Преобразовать состояние (число или массив) в одно число.
   * Для многозначного случая "склеиваем" цифры.
   */
  stateToNumber(state) {
    if (Array.isArray(state)) {
      // [единицы, десятки, сотни] -> число
      return state.reduce(
        (acc, digit) => acc * 10 + digit,
        0
      );
    }
    return state ?? 0;
  }

  /**
   * Проверка физической валидности состояния:
   * каждая цифра должна быть в пределах minState..maxState.
   */
  isValidState(state) {
    const { minState, maxState } = this.config;

    if (Array.isArray(state)) {
      return state.every(
        v => v >= minState && v <= maxState
      );
    }
    return state >= minState && state <= maxState;
  }

  /**
   * Дать список допустимых действий из текущего состояния
   * (для указанного разряда position).
   *
   * ВАЖНО:
   * - Шаг = целое число со знаком, ±d.
   * - d ∈ selectedDigits.
   * - Если includeFive=false, вырезаем ±5.
   * - После шага состояние не должно выйти за 0..9.
   * - Первый шаг не может быть минусом.
   * - onlyAddition/onlySubtraction уважаем.
   *
   * Возвращаем:
   *  - для одного разряда: [ +3, -2, +7, ... ]
   *  - для нескольких разрядов: [ {position:0,value:+3}, ... ]
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      selectedDigits,
      minState,
      maxState,
      onlyAddition,
      onlySubtraction,
      digitCount,
      includeFive
    } = this.config;

    const v = this.getDigitValue(currentState, position);
    const deltas = new Set();

    for (const d of selectedDigits) {
      // Если методически нельзя трогать верхнюю — запрещаем ±5.
      // (После нашего автофиксера includeFiveFinal это по сути:
      //  - если ребёнок тренирует только мелкие числа, и пятёрка реально не разрешена,
      //    тогда ±5 нельзя;
      //  - но если он тренирует 6,7,8,9, мы насильно включили includeFive=true,
      //    так что ±5 остаётся разрешённой базовой модуляцией жеста.)
      if (d === 5 && !includeFive) {
        continue;
      }

      const plus = +d;
      const minus = -d;

      // кандидат: +d
      if (!onlySubtraction) {
        const afterPlus = v + plus;
        if (afterPlus >= minState && afterPlus <= maxState) {
          deltas.add(plus);
        }
      }

      // кандидат: -d
      if (!onlyAddition) {
        if (!isFirstAction) {
          const afterMinus = v + minus;
          if (afterMinus >= minState && afterMinus <= maxState) {
            deltas.add(minus);
          }
        }
      }
    }

    const resultDeltas = Array.from(deltas);

    // Многозначный режим → оборачиваем {position,value}
    if (digitCount > 1) {
      return resultDeltas.map(value => ({ position, value }));
    }

    // Один разряд → просто числа
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;

    console.log(
      `⚙️ getAvailableActions(simple): state=${stateStr}, pos=${position}, v=${v} → [${resultDeltas.join(
        ", "
      )}]`
    );

    return resultDeltas;
  }

  /**
   * Проверка валидности целого примера.
   *
   * Пример формата:
   * {
   *   start: 0,
   *   steps: [
   *     { action:+3, fromState:0, toState:3 },
   *     { action:+1, fromState:3, toState:4 },
   *     { action:+5, fromState:4, toState:9 },
   *     { action:-7, fromState:9, toState:2 },
   *     ...
   *   ],
   *   answer: 2
   * }
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const {
      digitCount,
      selectedDigits,
      minState,
      maxState
    } = this.config;

    // 1. старт обязан быть 0 (или [0,...])
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Стартовое состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. первый шаг должен быть плюсом ( >0 )
    if (steps.length > 0) {
      const firstActionRaw = steps[0].action;
      const firstValue =
        typeof firstActionRaw === "object"
          ? firstActionRaw.value
          : firstActionRaw;

      if (firstValue <= 0) {
        console.error(`❌ Первое действие ${firstValue} не положительное`);
        return false;
      }
    }

    // 3. все промежуточные состояния валидны
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const stateStr = Array.isArray(step.toState)
          ? `[${step.toState.join(", ")}]`
          : step.toState;
        console.error(
          `❌ Состояние ${stateStr} вне диапазона ${minState}..${maxState}`
        );
        return false;
      }
    }

    // 4. арифметика: start + все шаги == answer
    let calc = start;
    for (const step of steps) {
      calc = this.applyAction(calc, step.action);
    }
    const calcNum = this.stateToNumber(calc);
    const answerNum = this.stateToNumber(answer);

    if (calcNum !== answerNum) {
      console.error(
        `❌ Пересчёт ${calcNum} ≠ заявленному answer ${answerNum}`
      );
      return false;
    }

    // 5. финальный ответ:
    // для одного разряда он должен быть либо 0,
    // либо содержаться в selectedDigits.
    if (digitCount === 1) {
      const allowedFinals = new Set([0, ...selectedDigits]);
      if (!allowedFinals.has(answerNum)) {
        console.error(
          `❌ Финальный ответ ${answerNum} не входит в {0, ${selectedDigits.join(
            ", "
          )}}`
        );
        return false;
      }
    } else {
      // многоразрядный случай: просто проверим валидность по диапазону
      if (!this.isValidState(answer)) {
        console.error(
          `❌ Финальное состояние ${JSON.stringify(
            answer
          )} выходит за пределы ${minState}..${maxState}`
        );
        return false;
      }
    }

    console.log(
      `✅ Пример валиден (${this.name}): финал=${answerNum}, разрешённые финалы {0, ${selectedDigits.join(
        ", "
      )}}`
    );
    return true;
  }
}
