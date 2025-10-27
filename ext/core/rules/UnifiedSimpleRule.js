// ext/core/rules/UnifiedSimpleRule.js
//
// Унифицированное правило для тренировки "Просто" (один столбец абакуса без переноса).
//
// Ключевые принципы новой логики генерации цепочек:
//
// 1. Мы всегда начинаем с 0 (все бусины неактивны). Стартовое состояние не показывается.
// 2. Первый шаг ВСЕГДА положительный (+N), потому что невозможно начать с минуса из нуля.
// 3. Каждый шаг в примере — это целое число со знаком, например +3 или -7.
//    Мы НЕ раскладываем его внутри правила "Просто" на микродвижения типа
//    "подними верхнюю, опусти нижние и т.д." Для ученика это один шаг.
//    Значит шаг может быть 1..9 по модулю, в том числе 6,7,8,9.
// 4. Ограничение физики: после каждого шага текущее значение разряда
//    обязано оставаться в диапазоне 0..9 (одна спица = максимум 9).
//    То есть запрещаем ходы, которые уводят ниже 0 или выше 9.
// 5. Список разрешённых абсолютных значений шага задаётся настройками (selectedDigits).
//    Если выбраны только [3], пример будет типа +3 -3 +3 -3.
//    Если выбраны [2,5,7], возможны +2, -2, +5, -5, +7, -7.
// 6. Мы уважаем флаги onlyAddition / onlySubtraction:
//    - onlyAddition: разрешаем только плюсы;
//    - onlySubtraction: только минусы (НО всё равно первый шаг должен быть плюсом — см. ниже).
// 7. Мы НЕ навязываем "через 5", "друзья 10", "братья" — это другие режимы.

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // 1. Разрешённые абсолютные шаги из блока «Просто»
    // Каждый шаг потом будет +d или -d, где d ∈ selectedDigits.
    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];

    // 2. includeFive — методический флаг "можно ли трогать верхнюю бусину (5)".
    // Он не запрещает всю механику, но если false,
    // мы не должны давать шаги с модулем 5.
    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    this.name = "Просто";
    this.description =
      "Тренируем прямые плюсы и минусы на одном разряде без переноса";

    // 3. Финальная конфигурация правила
    this.config = {
      // физические пределы для ОДНОГО разряда
      minState: 0,
      maxState: 9, // всегда работаем в диапазоне 0..9

      // ограничения длины примера (кол-во шагов в цепочке)
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // разрешённые абсолютные значения шага
      selectedDigits,

      // статус "пятёрки" (для вырезания +/-5 при необходимости)
      includeFive,
      hasFive: includeFive,

      // требования методики:
      // 1) старт всегда из 0
      // 2) первый шаг не может быть минусом
      firstActionMustBePositive: true,

      // многоразрядность (в будущем):
      digitCount: config.digitCount ?? 1,

      // прочие флаги совместимости/ограничений
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // (на будущее / совместимость)
      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

      // сохраним все остальные поля, чтобы не потерять поведение старого кода
      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule (новая логика "Просто"):
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

  /**
   * Сколько шагов нужно в примере.
   * Возвращаем случайное значение между minSteps и maxSteps включительно.
   */
  generateStepsCount() {
    const min = this.config.minSteps ?? 2;
    const max = this.config.maxSteps ?? min;
    if (min === max) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /**
   * Стартовое состояние абакуса.
   * Для одного разряда → просто 0.
   * Для нескольких разрядов → массив нулей длиной digitCount.
   */
  generateStartState() {
    const dc = this.config.digitCount ?? 1;
    if (dc === 1) return 0;
    return Array(dc).fill(0);
  }

  /**
   * Красивое форматирование шага для UI (например "+3", "-7").
   * В многозначном случае action может прийти как {position,value}.
   */
  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    return action >= 0 ? `+${action}` : `${action}`;
  }

  /**
   * Получить текущее значение одного разряда (0..9),
   * даже если currentState хранится как массив разрядов.
   */
  getDigitValue(currentState, position = 0) {
    if (Array.isArray(currentState)) {
      return currentState[position] ?? 0;
    }
    return currentState ?? 0;
  }

  /**
   * Применить действие (одно число со знаком или объект {position,value})
   * к состоянию currentState.
   */
  applyAction(currentState, action) {
    if (typeof action === "object" && action !== null) {
      // многоразрядный случай типа {position, value}
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
   * Преобразовать состояние (число или массив) в одно число (для показа/валидации).
   * Для многоразрядного варианта склеиваем как десятичное число: [A,B,C] => A*100+B*10+C.
   */
  stateToNumber(state) {
    if (Array.isArray(state)) {
      return state.reduce((acc, digit) => acc * 10 + digit, 0);
    }
    return state ?? 0;
  }

  /**
   * Проверка валидности состояния:
   * каждое значение в пределах [minState..maxState].
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
   * Какие ходы (+N / -N) мы МОЖЕМ сделать сейчас (для указанного разряда).
   *
   * Правила:
   *  - шаг = целое число со знаком, например +3 или -7;
   *  - |шаг| (модуль шага) должен быть в this.config.selectedDigits;
   *  - если includeFive === false → нельзя ±5;
   *  - после применения шага состояние не должно выйти за пределы [0..9];
   *  - если это ПЕРВЫЙ шаг (isFirstAction === true),
   *    то шаг не может быть отрицательным;
   *  - если onlyAddition === true → даём только плюсы;
   *    если onlySubtraction === true → только минусы
   *    (но на первом шаге всё равно запрещаем минус, чтобы можно было уйти с нуля).
   *
   * Возвращает массив:
   *   - для одного разряда: [ +3, -2, +7, ... ]
   *   - для нескольких разрядов: [ {position:0,value:+3}, {position:0,value:-2}, ... ]
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
      // если нельзя трогать 5 методически — вычёркиваем +/-5
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
        // минус нельзя, если это первый шаг
        if (!isFirstAction) {
          const afterMinus = v + minus;
          if (afterMinus >= minState && afterMinus <= maxState) {
            deltas.add(minus);
          }
        }
      }
    }

    const resultDeltas = Array.from(deltas);

    // Многозначный случай: вернуть шаги как объекты {position,value}
    if (digitCount > 1) {
      return resultDeltas.map(value => ({ position, value }));
    }

    // Одноразрядный случай: вернуть список чисел
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;

    console.log(
      `⚙️ getAvailableActions(simple v3): state=${stateStr}, pos=${position}, v=${v} → [${resultDeltas.join(
        ", "
      )}]`
    );

    return resultDeltas;
  }

  /**
   * Валидация готового примера.
   *
   * Пример выглядит так:
   * {
   *   start: 0,
   *   steps: [
   *     { action: +3, fromState:0, toState: 3 },
   *     { action: +1, fromState:3, toState: 4 },
   *     { action: +5, fromState:4, toState: 9 },
   *     { action: -7, fromState:9, toState: 2 },
   *     { action: +6, fromState:2, toState: 8 },
   *     { action: -8, fromState:8, toState: 0 }
   *   ],
   *   answer: 0
   * }
   *
   * Условия валидности:
   *
   * 1. start должен быть 0 (или [0,...]).
   *
   * 2. Первый шаг (steps[0].action) должен быть >0.
   *
   * 3. Каждый промежуточный toState должен быть валидным состоянием
   *    (все цифры в пределах 0..9).
   *
   * 4. Если мы последовательно применим все action к start,
   *    мы должны получить answer.
   *
   * 5. Для одного разряда (digitCount === 1):
   *    answer должен быть либо 0,
   *    либо одной из выбранных цифр selectedDigits.
   *    Примеры:
   *      selectedDigits = [1..9] → финал может быть 0..9
   *      selectedDigits = [3]    → финал может быть 0 или 3
   *      selectedDigits = [2,5]  → финал может быть 0,2,5
   *
   * 6. Для многоразрядного режима (digitCount > 1):
   *    запрещаем отрицательные значения, и значения >9,
   *    но не навязываем правило "ответ ∈ выбранных цифр".
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { digitCount, selectedDigits, minState, maxState } = this.config;

    // 1. старт
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Стартовое состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. первый шаг должен быть положительным
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

    // 3. все промежуточные состояния должны быть валидны
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

    // 4. арифметика: start + все action == answer
    let calc = start;
    for (const step of steps) {
      calc = this.applyAction(calc, step.action);
    }
    const calcNum = this.stateToNumber(calc);
    const answerNum = this.stateToNumber(answer);

    if (calcNum !== answerNum) {
      console.error(`❌ Пересчёт ${calcNum} ≠ заявленному answer ${answerNum}`);
      return false;
    }

    // 5. проверка финального ответа
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
      // многоразрядный случай: просто проверяем, что ответ сам по себе валиден
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
