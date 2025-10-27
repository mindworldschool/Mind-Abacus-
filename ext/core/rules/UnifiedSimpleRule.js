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
   * КЛЮЧЕВОЕ: теперь мы считаем не "микро-шага +1 или +5 отдельно",
   * а "что можно сделать одним жестом руки СЕЙЧАС".
   *
   * Алгоритм:
   *  1. Берём текущее значение разряда v (0..9).
   *  2. Перебираем все возможные целевые значения v' от 0 до 9.
   *     v' — это "как может выглядеть столбик ПОСЛЕ одного жеста".
   *     (то есть можно одним жестом поднять/опустить сразу несколько бусин,
   *      в том числе верхнюю + нижние вместе → это даёт дельты типа +6,+7,+8,+9).
   *  3. Дельта = v' - v. Это то, что мы показываем ребёнку (+7, -3, и т.д.).
   *  4. Фильтруем дельты:
   *     - нельзя выходить за [0..9],
   *     - первый шаг не может быть минусом,
   *     - если onlyAddition / onlySubtraction активны, уважаем их,
   *     - модуль дельты должен быть среди выбранных цифр в блоке «Просто»,
   *     - если дельта по модулю 5, но пятёрка запрещена → выкидываем.
   *
   * Для многозначных (digitCount > 1) те же дельты упаковываются как { position, value }.
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
      onlySubtraction,
    } = this.config;

    // текущее значение конкретного разряда (0..9)
    const v = this.getDigitValue(currentState, position);

    let possibleDeltas = [];

    // Перебираем ВСЕ потенциальные целевые состояния 0..9
    // и смотрим, можно ли считать переход v -> target допустимым как один жест.
    for (let target = 0; target <= 9; target++) {
      if (target === v) continue; // нет смысла добавлять "0"

      const delta = target - v;    // что ребёнок увидит (+7, -3 и т.д.)
      const absDelta = Math.abs(delta);

      // 1. не выходим за физический диапазон (в теории это уже гарантировано,
      //    но пусть будет явно)
      if (v + delta < 0 || v + delta > 9) continue;

      // 2. первый шаг не может быть отрицательным
      if (isFirstAction && delta < 0) continue;

      // 3. уважаем режимы только плюс / только минус
      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;

      // 4. фильтр по выбранным цифрам в блоке «Просто»
      // если пользователь не выбрал, например, 7 — мы не даём шаг ±7
      if (!selectedDigits.includes(absDelta)) continue;

      // 5. если шаг ±5, но пятёрка методически "запрещена"
      if (absDelta === 5 && !includeFive) continue;

      // 6. логика "нельзя сразу в минус больше, чем у нас активно":
      //    если мы хотим дельту -N, у нас должно быть достаточно "активных бусин",
      //    чтобы это реально можно было снять за один жест.
      //    Мы получаем это условие автоматически из диапазона 0..9,
      //    потому что если бы нельзя было снять -8 (слишком много),
      //    то target < 0, и мы бы уже отфильтровали через диапазон.
      //    То есть спецпроверку не надо писать отдельно.

      possibleDeltas.push(delta);
    }

    // Удаляем дубли и защиту от нуля
    possibleDeltas = [...new Set(possibleDeltas.filter(d => d !== 0))];

    // Если это многозначный режим → упаковываем как {position, value}
    let result;
    if (digitCount > 1) {
      result = possibleDeltas.map(value => ({
        position,
        value
      }));
    } else {
      result = possibleDeltas.slice(); // просто числа, типа [+7, -3, +2]
    }

    // итоговая отладка
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
