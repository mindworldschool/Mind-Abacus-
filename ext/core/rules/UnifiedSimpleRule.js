// ext/core/rules/UnifiedSimpleRule.js
// Унифицированное правило для тренировки "Просто" (1-5) с поддержкой
// - режима "Просто 4" (без верхней косточки, без пятёрки),
// - режима "Просто 5" (с верхней косточкой),
// - многоразрядных чисел,
// - ограничений по направлению и шагам.
// Это правило используется по умолчанию, когда мы не в специальных режимах (6/7/8/9).

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // --- 1. Какие цифры выбраны
    // это разрешённые "шаги", с учётом расширения снаружи (generator.js)
    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];

    // --- 2. includeFive управляет режимом "Просто 4" vs "Просто 5"
    // приоритет такой:
    //  1. config.includeFive        (то, что сформировал generator.js)
    //  2. config.blocks.simple...   (UI-блок)
    //  3. если среди выбранных шагов есть 5 — считаем что можно пятёрку
    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    // это флаг наличия верхней косточки
    const hasFive = includeFive;

    this.name = hasFive ? "Просто с 5" : "Просто";
    this.description = hasFive
      ? "Работа с нижними и верхней косточками (0–9)"
      : "Работа только с нижними косточками (0–4)";

    // --- 3. Собираем финальную конфигурацию правила
    this.config = {
      // физические пределы для ОДНОГО разряда
      // maxState — максимально допустимое промежуточное состояние
      // maxFinalState — во что должен вернуться ответ в конце
      // в методике:
      //   без пятёрки: конец должен быть в 0..4
      //   с пятёркой: допустимы промежуточные состояния до 9, но конец ≤5
      minState: 0,
      maxState: hasFive ? 9 : 4,
      maxFinalState: hasFive ? 5 : 4,

      // ограничения длины примера
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 4,

      // какие шаги считаются допустимыми (1,2,3,4,5 и т.д.)
      selectedDigits,
      hasFive,                // есть ли верхняя косточка
      includeFive: hasFive,   // дублируем явно, чтобы не вычислять каждый раз
      onlyFiveSelected: config.onlyFiveSelected || false,

      // методические требования
      firstActionMustBePositive: true,

      // параметры многоразрядности
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,

      // направление (только сложение / только вычитание)
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,

      // блоки обучения (на следующих этапах "братья", "друзья", "микс")
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // остальное (actions, blocks, requireBlock, и т.д.)
      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule создано: ${this.name}
  digitsAllowed=[${selectedDigits.join(", ")}]
  digitCount=${this.config.digitCount}
  combineLevels=${this.config.combineLevels}
  includeFive=${this.config.includeFive}
  onlyAddition=${this.config.onlyAddition}
  onlySubtraction=${this.config.onlySubtraction}
`
    );
  }

  /**
   * Получаем доступные действия для текущего состояния.
   * Для 1 разряда возвращает массив чисел [+1, -2, +5 ...].
   * Для нескольких разрядов возвращает массив объектов вида { position, value },
   * где position — индекс разряда (0 = единицы), value — шаг на этом разряде.
   *
   * @param {number|number[]} currentState - текущее состояние (одна цифра или массив разрядов)
   * @param {boolean} isFirstAction - это первый шаг в примере?
   * @param {number} position - с каким разрядом работаем (0 — младший)
   * @returns {Array<number|{position:number,value:number}>}
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      includeFive,
      selectedDigits,
      digitCount,
      onlyAddition,
      onlySubtraction
    } = this.config;

    // получаем текущее значение конкретного разряда
    const digitValue = this.getDigitValue(currentState, position);

    // раскладываем это значение на физику абакуса
    // верхняя косточка активна, если значение >=5 и вообще разрешено работать с 5
    const isUpperActive = includeFive && digitValue >= 5;
    const activeLower = isUpperActive ? digitValue - 5 : digitValue; // сколько нижних косточек уже поднято
    const inactiveLower = 4 - activeLower; // сколько нижних косточек ещё свободны

    let validActions = [];

    for (const digit of selectedDigits) {
      // положительные шаги
      if (digit === 5 && includeFive) {
        // +5: можно только если верхняя сейчас не активна и не вылезем за 9
        if (!isUpperActive && digitValue + 5 <= 9) {
          validActions.push(digit);
        }
      } else if (digit < 5) {
        // +1..+4: можно если есть свободные нижние косточки и не перелезем за 9
        if (inactiveLower >= digit && digitValue + digit <= 9) {
          validActions.push(digit);
        }
      }

      // отрицательные шаги
      if (!isFirstAction) {
        if (digit === 5 && includeFive) {
          // -5: можно только если верхняя активна
          if (isUpperActive) {
            validActions.push(-5);
          }
        } else if (digit < 5) {
          // -1..-4: можно если есть активные нижние косточки и не уходим ниже 0
          if (activeLower >= digit && digitValue - digit >= 0) {
            validActions.push(-digit);
          }
        }
      }
    }

    // правило: первое действие должно быть положительным
    if (isFirstAction) {
      validActions = validActions.filter(a => a > 0);
    }

    // правило: если в этом разряде сейчас 0 — не даём чисто отрицательного старта
    if (digitValue === 0 && !isFirstAction) {
      validActions = validActions.filter(a => a > 0);
    }

    // правило "только пятёрка"
    if (this.config.onlyFiveSelected && includeFive) {
      const only5 = validActions.filter(a => Math.abs(a) === 5);
      if (only5.length > 0) {
        validActions = only5;
      }
    }

    // ограничение направления (только плюс / только минус)
    if (onlyAddition) {
      validActions = validActions.filter(a => {
        const v = typeof a === "object" ? a.value : a;
        return v > 0;
      });
    }
    if (onlySubtraction) {
      validActions = validActions.filter(a => {
        const v = typeof a === "object" ? a.value : a;
        return v < 0;
      });
    }

    // многозначный режим → действия становятся объектами { position, value }
    if (digitCount && digitCount > 1) {
      validActions = validActions.map(value => ({ position, value }));

      const combineLevels = this.config.combineLevels ?? false;
      if (!combineLevels) {
        // при combineLevels=false не разрешаем действия,
        // которые приведут число ниже минимального N-разрядного значения
        const minFinal = this.getMinFinalNumber();

        validActions = validActions.filter(action => {
          const newState = this.applyAction(currentState, action);
          const newNumber = this.stateToNumber(newState);
          return newNumber >= minFinal;
        });
      }
    }

    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;

    console.log(
      `✅ Доступные действия из ${stateStr} (разряд ${position}, ${
        this.name
      }): [${validActions
        .map(a =>
          typeof a === "object" ? `{${a.position}:${a.value}}` : a
        )
        .join(", ")}]`
    );

    return validActions;
  }

  /**
   * Валидация целого примера
   * Проверяем:
   *  - стартовое состояние валидно,
   *  - первое действие положительное,
   *  - финальное состояние в допустимом диапазоне,
   *  - все промежуточные состояния валидны,
   *  - арифметика сходится.
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { maxFinalState, digitCount } = this.config;

    // 1. старт должен быть 0 или массив нулей
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Начальное состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. первое действие должно быть положительным
    if (steps.length > 0) {
      const firstAction = steps[0].action;
      const firstValue =
        typeof firstAction === "object" ? firstAction.value : firstAction;
      if (firstValue <= 0) {
        console.error(`❌ Первое действие ${firstValue} не положительное`);
        return false;
      }
    }

    // 3. финальное состояние в допустимом диапазоне
    const answerNum = this.stateToNumber(answer);
    const minFinal = this.getMinFinalNumber();
    const maxFinal = this.getMaxFinalNumber();

    if (digitCount === 1) {
      // однозначные: ответ должен "закрываться" обратно в 0..4 или 0..5,
      // в зависимости от includeFive
      if (answerNum > maxFinalState || answerNum < 0) {
        console.error(
          `❌ Финал ${answerNum} вне диапазона 0-${maxFinalState}`
        );
        return false;
      }
    } else {
      // многозначные: ответ просто должен оставаться в разрешённом диапазоне разрядности
      if (answerNum < minFinal || answerNum > maxFinal) {
        console.error(
          `❌ Финал ${answerNum} вне диапазона ${minFinal}-${maxFinal}`
        );
        return false;
      }
    }

    // 4. промежуточные состояния валидны по физике
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const stateStr = Array.isArray(step.toState)
          ? `[${step.toState.join(", ")}]`
          : step.toState;
        console.error(`❌ Состояние ${stateStr} не валидно`);
        return false;
      }
    }

    // 5. контроль арифметики (сумма шагов действительно даёт answer)
    let calc = start;
    for (const step of steps) {
      calc = this.applyAction(calc, step.action);
    }
    const calcNum = this.stateToNumber(calc);

    if (calcNum !== answerNum) {
      console.error(`❌ Расчёт ${calcNum} ≠ ответу ${answerNum}`);
      return false;
    }

    console.log(`✅ Пример валиден (${this.name})`);
    return true;
  }
}
