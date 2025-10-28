// ext/core/rules/UnifiedSimpleRule.js
//
// Унифицированное правило для тренировки "Просто".
//
// Новая версия getAvailableActions:
//  - больше НЕ пытается эмулировать "один физический жест" на абакусе;
//  - шагом считается любая разрешённая цифра из блока "Просто"
//    (selectedDigits), взятая со знаком + или -,
//    если после применения этого шага значение остаётся в пределах 0..9;
//  - это даёт равные шансы на 6,7,8,9;
//  - это позволяет кейсы вида [+6,-6,+6,-6...] когда выбрана только цифра 6.
//
// Остальная методика остаётся:
//  - старт всегда 0;
//  - первый шаг не может быть отрицательным;
//  - onlyAddition / onlySubtraction уважаются;
//  - includeFive=false режет шаги с модулем 5;
//  - для digitCount>1 возвращаем {position,value}.

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];

    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    this.name = "Просто";
    this.description =
      "Тренируем прямые плюсы и минусы без переноса. Шаг = целое число ±N из выбранных цифр.";

    this.config = {
      // Физический диапазон одной стойки
      minState: 0,
      maxState: 9,

      // длина примера
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // какие абсолютные значения шага разрешены ребёнку
      selectedDigits,

      includeFive,
      hasFive: includeFive,

      // методические требования
      firstActionMustBePositive: true,

      // разрядность
      digitCount: config.digitCount ?? 1,

      // совместимость с остальной системой
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,
      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule активна:
  digitsAllowed=[${selectedDigits.join(", ")}]
  digitCount=${this.config.digitCount}
  minSteps=${this.config.minSteps}
  maxSteps=${this.config.maxSteps}
  includeFive=${this.config.includeFive}
  onlyAddition=${this.config.onlyAddition}
  onlySubtraction=${this.config.onlySubtraction}
  firstActionMustBePositive=${this.config.firstActionMustBePositive}`
    );
  }

  // -- утилиты (эти остаются как были) --

  generateStepsCount() {
    const min = this.config.minSteps ?? 2;
    const max = this.config.maxSteps ?? min;
    if (min === max) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  generateStartState() {
    const dc = this.config.digitCount ?? 1;
    if (dc === 1) return 0;
    return Array(dc).fill(0);
  }

  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    return action >= 0 ? `+${action}` : `${action}`;
  }

  getDigitValue(currentState, position = 0) {
    if (Array.isArray(currentState)) {
      return currentState[position] ?? 0;
    }
    return currentState ?? 0;
  }

  applyAction(currentState, action) {
    if (typeof action === "object" && action !== null) {
      // многозначный случай: { position, value }
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

  stateToNumber(state) {
    if (Array.isArray(state)) {
      return state.reduce((acc, digit) => acc * 10 + digit, 0);
    }
    return state ?? 0;
  }

  isValidState(state) {
    const { minState, maxState } = this.config;
    if (Array.isArray(state)) {
      return state.every(v => v >= minState && v <= maxState);
    }
    return state >= minState && state <= maxState;
  }

  /**
   * НОВАЯ ВЕРСИЯ.
   *
   * Возвращаем МНОЖЕСТВО допустимых шагов из текущего состояния.
   * Логика теперь простая и соответствует методике упражнений:
   *
   * - Для каждой разрешённой цифры d из selectedDigits:
   *      кандидаты шагов: +d и -d.
   *
   * - Фильтры:
   *    1) если includeFive === false и d === 5 → пропускаем d вообще;
   *    2) если onlyAddition === true → запрещаем минусы;
   *       если onlySubtraction === true → запрещаем плюсы
   *       (НО для самого первого шага мы всё равно запретим минус ниже,
   *        чтобы из 0 не начинать с вычитания);
   *    3) если это первый шаг (isFirstAction === true) → запрещаем минус;
   *    4) проверяем, что after = current + delta остаётся в [0..9].
   *
   * - Для digitCount === 1 возвращаем массив чисел [ +6, -6, ... ].
   * - Для digitCount > 1 — массив объектов { position, value }.
   *
   * Это даёт:
   *   - при выбранной только "6": из 0 -> [+6], из 6 -> [+6? нет, 12>9], [-6? да],
   *     из 0 -> опять [+6] ... и т.д.
   *
   * Это также даёт право на шаги типа +7, +8, +9, если они выбраны,
   * и если текущее состояние + шаг не выходит за 9.
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      selectedDigits,
      includeFive,
      onlyAddition,
      onlySubtraction,
      digitCount,
      minState,
      maxState
    } = this.config;

    const v = this.getDigitValue(currentState, position);

    const resultSet = new Set();

    for (const d of selectedDigits) {
      // методическое ограничение: если пятёрка запрещена, то ±5 нельзя
      if (d === 5 && !includeFive) continue;

      // кандидат +d
      if (!onlySubtraction) {
        const afterPlus = v + d;
        if (afterPlus >= minState && afterPlus <= maxState) {
          resultSet.add(d); // положительный шаг
        }
      }

      // кандидат -d
      if (!onlyAddition) {
        // минус на первом шаге запрещён методикой "старт из 0 всегда плюс"
        if (!isFirstAction) {
          const afterMinus = v - d;
          if (afterMinus >= minState && afterMinus <= maxState) {
            resultSet.add(-d); // отрицательный шаг
          }
        }
      }
    }

    const deltas = Array.from(resultSet);

    // Если работаем с многозначным числом, нам нужно вернуть { position, value }
    if (digitCount > 1) {
      return deltas.map(value => ({ position, value }));
    }

    // Иначе просто числа
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;

    console.log(
      `⚙️ getAvailableActions(simple FINAL): state=${stateStr}, pos=${position}, v=${v} → [${deltas.join(", ")}]`
    );

    return deltas;
  }

  /**
   * Валидация готового примера.
   * Логика та же, что и раньше.
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const {
      digitCount,
      selectedDigits,
      minState,
      maxState
    } = this.config;

    // 1. старт должен быть 0
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Стартовое состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. первый шаг должен быть плюсом (>0)
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

    // 3. каждый промежуточный toState должен быть валиден (0..9 в каждом разряде)
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

    // 4. пересчитать арифметику вручную
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

    // 5. финал (только для одного разряда):
    //    ответ должен быть 0 или одной из выбранных цифр.
    if (digitCount === 1) {
      const allowedFinals = new Set([0, ...selectedDigits]);
      if (!allowedFinals.has(answerNum)) {
        console.error(
          `❌ Финальный ответ ${answerNum} не входит в {0, ${selectedDigits.join(", ")}}`
        );
        return false;
      }
    } else {
      // многоразрядный: просто проверяем, что финал в пределах
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
      `✅ Пример валиден (${this.name}): финал=${answerNum}, разрешённые финалы {0, ${selectedDigits.join(", ")}}`
    );
    return true;
  }
}
