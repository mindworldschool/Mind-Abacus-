// ext/core/rules/UnifiedSimpleRule.js
// Унифицированное правило для тренировки "Просто"
// Поддерживает:
// - режим "Просто 4" (без верхней косточки),
// - режим "Просто 5" (с верхней косточкой),
// - многоразрядные числа,
// - ограничения по направлению (только плюс / только минус),
// - требование, что первый шаг не может быть минусом,
// - отсутствие переноса между столбцами (никаких переходов через 10).
//
// Главный принцип:
//  Мы разрешаем ТОЛЬКО те шаги (+N / -N), которые ребёнок реально может сделать ОДНИМ ЖЕСТОМ
//  на данном состоянии стойки абакуса СЕЙЧАС,
//  без использования формул "через 5", "через 10", и т.д.

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // --- 1. Какие цифры выбраны в блоке «Просто»
    // Это разрешённые абсолютные дельты (например [1,2,3,4,5,6,7,8,9])
    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];

    // --- 2. includeFive управляет "Просто 4" vs "Просто 5"
    // Приоритет:
    //   1) config.includeFive (из generator.js),
    //   2) config.blocks.simple.includeFive (из UI),
    //   3) сам факт, что среди выбранных шагов есть 5.
    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    // флаг наличия верхней косточки
    const hasFive = includeFive;

    this.name = hasFive ? "Просто с 5" : "Просто";
    this.description = hasFive
      ? "Работа с нижними и верхней косточкой (0–9)"
      : "Работа только с нижними косточками (0–4)";

    // --- 3. Финальная конфигурация правила
    this.config = {
      // физические пределы для ОДНОГО разряда
      minState: 0,
      maxState: hasFive ? 9 : 4,

      // куда должен вернуться ответ в конце (только для одноразрядных примеров)
      // без пятёрки: конец в 0..4
      // с пятёркой: конец в 0..5
      maxFinalState: hasFive ? 5 : 4,

      // ограничения длины примера
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 4,

      // шаги, которые можно использовать (абсолютные дельты)
      selectedDigits,
      hasFive,              // есть ли верхняя косточка
      includeFive: hasFive, // дублируем для простоты
      onlyFiveSelected: config.onlyFiveSelected || false,

      // методические требования
      firstActionMustBePositive: true,

      // параметры многоразрядности
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,

      // ограничения направления
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,

      // (на будущее) "братья", "друзья", "микс"
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // остальное
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
   * Вернуть список допустимых действий из текущего состояния конкретного разряда.
   *
   * Важные моменты методики:
   *  - Мы не делаем переносы между столбцами.
   *    То есть значение разряда не может уйти <0 или >9.
   *
   *  - Мы считаем ЖЕСТ.
   *    Жест — это реальное одно движение руки для данного столба сейчас:
   *      * поднять несколько нижних подряд,
   *      * опустить несколько нижних подряд,
   *      * опустить верхнюю,
   *      * поднять верхнюю и нижние вместе,
   *      * снять всё.
   *
   *  - Если верхняя бусина сейчас не активна (v < 5),
   *    мы МОЖЕМ одним жестом сразу опустить верхнюю и несколько нижних
   *    (то есть из 0 можно сразу получить 6,7,8,9),
   *    потому что это просто "активировать верхнюю + поднять часть нижних".
   *    Это НЕ перенос. Это остаётся внутри одного разряда.
   *
   *  - Если верхняя активна (v >= 5),
   *    можно:
   *      * добрать оставшиеся нижние вверх (до 9),
   *      * понижать только нижние (6→5,7→6,...),
   *      * снять только верхнюю (-5),
   *      * снять всё (-v).
   *
   * @param {number|number[]} currentState текущее состояние (число или массив разрядов)
   * @param {boolean} isFirstAction это первый шаг в примере?
   * @param {number} position индекс столбика (0 = единицы, 1 = десятки, ...)
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

    // активна ли верхняя косточка в этом столбце
    const isUpperActive = includeFive && v >= 5;

    // сколько нижних бусин поднято сейчас (0..4)
    const lowerCount = isUpperActive ? (v - 5) : v;

    // Здесь мы вычисляем ВСЕ состояния, в которые можно перейти ОДНИМ ЖЕСТОМ
    // из текущего v. Потом превратим их в дельты.
    const targets = new Set();

    // ===== ПЛЮСЫ (поднять бусины) =====
    if (!onlySubtraction) {
      if (!isUpperActive) {
        // верхняя НЕ активна (v < 5)

        // 1) можно поднять ещё нижние, но только в пределах нижних (до 4)
        //    пример: v=2 -> можем стать 3 (+1), 4 (+2)
        for (let next = v + 1; next <= 4; next++) {
          targets.add(next);
        }

        // 2) можно ОДНИМ ЖЕСТОМ опустить верхнюю и одновременно поднять часть нижних:
        //    то есть попасть сразу в состояние 5..9
        //    пример: из 0 → 6 (+6), 7 (+7), 8 (+8), 9 (+9)
        //    пример: из 3 → 8 (+5), 9 (+6)
        for (let next = 5; next <= 9; next++) {
          targets.add(next);
        }
      } else {
        // верхняя УЖЕ активна (v >= 5)
        // можем поднимать оставшиеся нижние вверх до 9
        // пример: v=6 -> можем стать 7 (+1),8 (+2),9 (+3)
        for (let next = v + 1; next <= 9; next++) {
          targets.add(next);
        }
      }
    }

    // ===== МИНУСЫ (опустить бусины) =====
    if (!onlyAddition) {
      if (!isUpperActive) {
        // верхняя НЕ активна (v < 5)
        // можем опустить часть нижних или все нижние:
        // пример: v=3 → можно стать 2 (-1),1 (-2),0 (-3)
        for (let next = 0; next < v; next++) {
          targets.add(next);
        }
      } else {
        // верхняя активна (v >= 5)
        // 1) можно опускать ТОЛЬКО нижние, оставив верхнюю на месте.
        //    пример: v=8 (5+3) → можем стать 7 (-1),6 (-2),5 (-3)
        //    Это даёт состояния [5 .. v-1] (если v>5)
        for (let next = v - 1; next >= 5; next--) {
          targets.add(next);
        }

        // 2) можно снять только верхнюю:
        //    пример: v=6 (5+1) → снять верхнюю → 1 (-5)
        //    пример: v=9 (5+4) → снять верхнюю → 4 (-5)
        targets.add(lowerCount);

        // 3) можно снять ВООБЩЕ ВСЁ:
        //    пример: v=9 → стать 0 (-9)
        //    пример: v=6 → стать 0 (-6)
        targets.add(0);
      }
    }

    // Теперь конвертируем эти целевые состояния в дельты (шаги)
    let deltas = [];
    for (const next of targets) {
      if (next === v) continue; // не добавляем "0"
      const delta = next - v;
      const absDelta = Math.abs(delta);

      // правило: первое действие не может быть минусом
      if (isFirstAction && delta < 0) continue;

      // уважаем глобальные ограничения направления
      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;

      // фильтр по выбранным цифрам (допустимые абсолютные шаги)
      if (!selectedDigits.includes(absDelta)) continue;

      // запрещаем любые +/-5, если пятёрка не разрешена методически
      if (absDelta === 5 && !includeFive) continue;

      // защита от выхода за пределы 0..9 (переносы запрещены)
      const after = v + delta;
      if (after < 0 || after > 9) continue;

      deltas.push(delta);
    }

    // удаляем дубликаты
    deltas = [...new Set(deltas)];

    // Формат результата:
    //  - для одного разряда → просто массив чисел [ +6, -1, +2 ... ]
    //  - для нескольких разрядов → массив объектов { position, value }
    let result;
    if (digitCount > 1) {
      result = deltas.map(value => ({
        position,
        value
      }));
    } else {
      result = deltas.slice();
    }

    // лог отладки
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
   * Проверка корректности целого примера.
   * - старт должен быть 0,
   * - первый шаг должен быть плюсом,
   * - финал в допустимом диапазоне,
   * - никакие промежуточные состояния не ломают физику,
   * - арифметика сходится.
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { maxFinalState, digitCount } = this.config;

    // 1. старт должен быть 0 или массивом нулей
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

    // 3. проверка финального состояния
    const answerNum = this.stateToNumber(answer);

    if (digitCount === 1) {
      // В одноразрядном режиме методика требует,
      // чтобы итог остался "в безопасной зоне"
      // (0..4 для Просто4, 0..5 для Просто5)
      if (answerNum > maxFinalState || answerNum < 0) {
        console.error(
          `❌ Финал ${answerNum} вне диапазона 0-${maxFinalState}`
        );
        return false;
      }
    } else {
      // В многоразрядном режиме:
      // важное ограничение — результат не должен быть отрицательным
      if (answerNum < 0) {
        console.error(
          `❌ Финал ${answerNum} не может быть отрицательным при ${digitCount} разрядах`
        );
        return false;
      }
    }

    // 4. промежуточные состояния должны быть валидными
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const stateStr = Array.isArray(step.toState)
          ? `[${step.toState.join(", ")}]`
          : step.toState;
        console.error(`❌ Состояние ${stateStr} не валидно`);
        return false;
      }
    }

    // 5. контроль арифметики: применяя шаги должны прийти к answer
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
