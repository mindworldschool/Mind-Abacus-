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
    // это разрешённые "шаги", которые пользователь отметил в блоке «Просто»
    // (напр. [1,2,3,4,6,7,8,9])
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

      // какие шаги считаются допустимыми (1,2,3,4,5...9)
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
   * Возвращает список допустимых действий для текущего состояния выбранного разряда.
   *
   * ВАЖНО:
   *  Мы больше НЕ говорим "можно перейти в любое состояние 0..9".
   *  Мы считаем реальную физику абакуса в ЭТОТ момент:
   *
   *  - сколько бусин уже активны (их можно СБРОСИТЬ → минус),
   *  - сколько бусин ещё не активны (их можно ПОДНЯТЬ → плюс).
   *
   *  Пример:
   *   значение 6 = верхняя (5) + одна нижняя (1).
   *   Значит:
   *     можно снять -1, -5, -6,
   *     можно добавить только +1, +2, +3,
   *     НО нельзя "просто -3", потому что у нас нет трёх активных нижних.
   *
   * Алгоритм:
   *  1. Узнаём текущее значение v (0..9) для нужного разряда.
   *  2. Считаем:
   *      - isUpperActive: верхняя косточка включена?
   *      - activeLower: сколько нижних сейчас поднято?
   *      - totalActive: сколько в сумме можем снять одним жестом (нижние + верхняя если активна).
   *      - totalInactive: сколько можем ещё поднять, не сделав перенос (>9 нельзя).
   *  3. Для каждой разрешённой цифры d из selectedDigits:
   *      - если d <= totalInactive → можно +d
   *      - если d <= totalActive  → можно -d
   *  4. Фильтруем:
   *      - первый шаг не может быть минусом,
   *      - onlyAddition / onlySubtraction,
   *      - запрещаем шаги с модулем 5, если includeFive=false,
   *      - шаг не должен выводить за 0..9.
   *
   * Если digitCount > 1, возвращаем объекты вида { position, value }.
   *
   * @param {number|number[]} currentState текущее состояние (число или массив разрядов)
   * @param {boolean} isFirstAction это первый шаг в примере?
   * @param {number} position индекс столбика (0 = младший разряд)
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

    // текущее значение конкретного разряда (0..9)
    const v = this.getDigitValue(currentState, position);

    // Физика текущего состояния стойки
    // isUpperActive = активна ли верхняя косточка
    const isUpperActive = includeFive && v >= 5;

    // Сколько нижних бусин поднято сейчас
    // если верхняя активна, то нижние = v - 5, иначе = v
    const activeLower = isUpperActive ? v - 5 : v;

    // Сколько всего "активных очков", которые мы можем сбросить одним жестом:
    // это сумма поднятых нижних (каждая =1) + верхней (если активна =5)
    const totalActive = activeLower + (isUpperActive ? 5 : 0); // максимум, что можно снять сразу

    // Сколько ещё можем ДОБАВИТЬ, не выйдя за пределы 9 в этом разряде
    // (никаких переносов сейчас не разрешаем)
    const totalInactive = 9 - v; // максимум, что можно прибавить одним жестом

    let validActions = [];

    // Перебираем только те величины шагов, которые пользователь разрешил через блок «Просто»
    for (const digit of selectedDigits) {
      if (Number.isNaN(digit) || digit <= 0) continue;

      // ПОЛОЖИТЕЛЬНЫЕ ШАГИ (+digit)
      if (digit <= totalInactive) {
        // не даём шаг +5, если пятёрка запрещена методикой
        if (!(digit === 5 && !includeFive)) {
          validActions.push(+digit);
        }
      }

      // ОТРИЦАТЕЛЬНЫЕ ШАГИ (-digit)
      // Первое действие не может быть отрицательным
      if (!isFirstAction) {
        if (digit <= totalActive) {
          // не даём шаг -5, если пятёрка запрещена
          if (!(digit === 5 && !includeFive)) {
            validActions.push(-digit);
          }
        }
      }
    }

    // Ограничения направления
    if (onlyAddition) {
      validActions = validActions.filter(vStep => vStep > 0);
    }
    if (onlySubtraction) {
      validActions = validActions.filter(vStep => vStep < 0);
    }

    // Защита диапазона 0..9 (на всякий случай)
    validActions = validActions.filter(delta => {
      const nextVal = v + delta;
      return nextVal >= 0 && nextVal <= 9;
    });

    // Удаляем дубликаты
    validActions = [...new Set(validActions)];

    // Если многозначный режим, заворачиваем в объекты {position,value}
    let result;
    if (digitCount > 1) {
      result = validActions.map(value => ({
        position,
        value
      }));
    } else {
      result = validActions.slice(); // просто [+6, -1, +2, ...]
    }

    // Отладка
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;

    console.log(
      `⚙️ getAvailableActions: state=${stateStr}, pos=${position}, v=${v} → [${result
        .map(a =>
          typeof a === "object"
            ? `{${a.position}:${a.value}}`
            : a
        )
        .join(", ")}]`
    );

    return result;
  }

  /**
   * Валидация целого примера.
   * Проверяем:
   *  - стартовое состояние валидно,
   *  - первое действие положительное,
   *  - финальное состояние валидно,
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

    // 3. финальное состояние
    const answerNum = this.stateToNumber(answer);

    if (digitCount === 1) {
      // однозначные: ответ должен "закрываться" обратно в 0..4 или 0..5
      if (answerNum > maxFinalState || answerNum < 0) {
        console.error(
          `❌ Финал ${answerNum} вне диапазона 0-${maxFinalState}`
        );
        return false;
      }
    } else {
      // многозначные:
      // единственное правило: ответ не может быть отрицательным
      if (answerNum < 0) {
        console.error(
          `❌ Финал ${answerNum} не может быть отрицательным при ${digitCount} разрядах`
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

    // 5. контроль арифметики (применяя шаги последовательно должны получить answer)
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
