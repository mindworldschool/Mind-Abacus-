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
    // Это разрешённые абсолютные дельты на экране (+1..+9, -1..-9 и т.д.)
    // Например: [1,2,3,4,5,6,7,8,9] или [1,2,5]
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

      // ограничения длины примера
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 4,

      // шаги, которые можно использовать (абсолютные дельты)
      selectedDigits,
      hasFive,              // есть ли верхняя косточка
      includeFive: hasFive, // дублируем для простоты
      onlyFiveSelected: config.onlyFiveSelected || false,

      // требования методики
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
  onlySubtraction=${this.config.onlySubtraction}`
    );
  }

  /**
   * Вернуть список допустимых действий из текущего состояния конкретного разряда.
   *
   * Логика физики:
   *
   * Текущее состояние разряда v (0..9)
   *  - v < 5: активны только нижние бусины (v штук), верхняя НЕ активна
   *  - v >= 5: активна верхняя (5) и (v-5) нижних
   *
   * Допустимые жесты плюса:
   *   - если верхняя НЕ активна:
   *       • просто поднять ещё нижние → v -> v+1 .. 4
   *       • одним жестом добавить верхнюю целиком поверх текущего состояния
   *         (не меняя уже поднятые нижние) → v -> v+5 (если <=9)
   *         примеры:
   *           0 -> 5 (+5)
   *           1 -> 6 (+5)
   *           4 -> 9 (+5)
   *         ❗ мы НЕ разрешаем "переформатировать" нижние и верхнюю вместе,
   *           то есть нельзя 4 -> 7 как «+3», потому что это требовало бы
   *           опустить часть нижних и одновременно опустить верхнюю.
   *
   *   - если верхняя уже активна:
   *       • можно добирать оставшиеся нижние вверх → v -> v+1 .. 9
   *
   * Допустимые жесты минуса:
   *   - если верхняя НЕ активна:
   *       • можно опускать нижние частично или полностью
   *         v -> v-1, v-2, ... , 0
   *
   *   - если верхняя активна:
   *       • можно опускать только нижние, но оставить верхнюю:
   *         v -> v-1, v-2, ..., 5
   *       • можно снять только верхнюю целиком,
   *         оставив нижние как были:
   *         v = (5 + k) -> k, где k = v - 5
   *         пример: 7 (5+2) -> 2 (-5)
   *       • можно снять всё:
   *         v -> 0 (-v)
   *
   * ВАЖНО:
   *  - мы НЕ делаем переносы между столбцами,
   *    то есть запрещаем уход <0 или >9
   *  - первый шаг не может быть минусом
   *  - опции "только плюс" / "только минус" тоже уважаем
   *  - шаг по модулю должен быть в выбранных цифрах блока «Просто»
   *  - если пятёрка выключена, ±5 запрещаем
   *
   * @param {number|number[]} currentState текущее состояние (число или массив разрядов)
   * @param {boolean} isFirstAction это первый шаг в примере?
   * @param {number} position индекс столбца (0 = единицы, 1 = десятки, ...)
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

    // Соберём все допустимые финальные состояния после одного жеста
    const targets = new Set();

    //
    // ===== ПЛЮСЫ (поднять бусины) =====
    //
    if (!onlySubtraction) {
      if (!isUpperActive) {
        // верхняя НЕ активна (v < 5)

        // (A) просто поднять ещё нижние: v -> v+1 .. 4
        for (let next = v + 1; next <= 4; next++) {
          targets.add(next);
        }

        // (B) одним жестом добавить верхнюю целиком
        //     (оставляя все уже поднятые нижние как есть):
        //     v -> v+5 (если есть верхняя и не выходим за 9)
        if (includeFive) {
          const next = v + 5; // это будет 5..9
          if (next <= 9) {
            targets.add(next);
          }
        }

        // ❗ Специально НЕ добавляем все состояния 5..9 как раньше.
        // Теперь разрешаем только v+5, чтобы
        // не было "4 → 7 (+3)", где ребёнок должен
        // одновременно убрать часть нижних и включить верхнюю.
      } else {
        // верхняя УЖЕ активна (v >= 5)
        // можно добирать оставшиеся нижние до 9
        for (let next = v + 1; next <= 9; next++) {
          targets.add(next);
        }
      }
    }

    //
    // ===== МИНУСЫ (опустить бусины) =====
    //
    if (!onlyAddition) {
      if (!isUpperActive) {
        // верхняя НЕ активна (v < 5):
        // можно опускать нижние частично или полностью
        // v -> v-1, v-2, ..., 0
        for (let next = v - 1; next >= 0; next--) {
          targets.add(next);
        }
      } else {
        // верхняя активна (v >= 5):

        // (A) опускать ТОЛЬКО нижние, оставляя верхнюю
        // v -> v-1, v-2, ..., 5
        for (let next = v - 1; next >= 5; next--) {
          targets.add(next);
        }

        // (B) снять только верхнюю, оставив нижние
        // v = 5+k -> k  (где k = lowerCount)
        // Примеры:
        //   6 (5+1) -> 1 (-5)
        //   9 (5+4) -> 4 (-5)
        targets.add(lowerCount);

        // (C) снять всё
        // v -> 0 (-v)
        targets.add(0);
      }
    }

    //
    // Превращаем финальные состояния в дельты (+N / -N)
    //
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

      // цифра шага должна быть разрешена в блоке «Просто»
      if (!selectedDigits.includes(absDelta)) continue;

      // если пятёрка выключена методически — нельзя ±5
      if (absDelta === 5 && !includeFive) continue;

      // физически не выходим за пределы 0..9 (без переноса)
      const after = v + delta;
      if (after < 0 || after > 9) continue;

      deltas.push(delta);
    }

    // убрать дубли
    deltas = [...new Set(deltas)];

    //
    // Формат результата:
    //  - для одного разряда → просто массив чисел [ +6, -1, +2 ... ]
    //  - для нескольких разрядов → массив объектов { position, value }
    //
    let result;
    if (digitCount > 1) {
      result = deltas.map(value => ({
        position,
        value
      }));
    } else {
      result = deltas.slice();
    }

    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;

    console.log(
      `⚙️ getAvailableActions strict v2: state=${stateStr}, pos=${position}, v=${v} → [${result
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
   * Валидация с учётом методики:
   *
   * 1. Старт всегда должен быть нулевым состоянием.
   * 2. Первое действие всегда положительное.
   * 3. Для одноразрядного примера:
   *    - финальный ответ должен быть либо 0,
   *      либо одной из разрешённых цифр блока «Просто».
   *      Примеры:
   *        [1..9]  → финал 0..9
   *        [1..6]  → финал 0..6
   *        [5]     → финал 0 или 5
   *        [1,2,5] → финал 0 или 1 или 2 или 5
   *
   *    Это заменяет старое "ответ ≤5".
   *
   * 4. Для многоразрядных примеров:
   *    - просто не должно быть отрицательного результата (нет переносов <0).
   *
   * 5. Все промежуточные состояния должны быть физически валидны.
   * 6. Арифметика шагов должна действительно приводить к answer.
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { digitCount, selectedDigits } = this.config;

    // 1. старт должен быть 0 (или [0,0,...])
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Начальное состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. первое действие обязано быть плюсом
    if (steps.length > 0) {
      const firstAction = steps[0].action;
      const firstValue =
        typeof firstAction === "object" ? firstAction.value : firstAction;
      if (firstValue <= 0) {
        console.error(`❌ Первое действие ${firstValue} не положительное`);
        return false;
      }
    }

    // 3. финальный ответ
    const answerNum = this.stateToNumber(answer);

    if (digitCount === 1) {
      // допустимые финалы = 0 + все выбранные цифры
      const allowedFinals = new Set([0, ...selectedDigits]);
      if (!allowedFinals.has(answerNum)) {
        console.error(
          `❌ Финальный ответ ${answerNum} не входит в допустимые: ${[
            ...allowedFinals
          ].join(", ")}`
        );
        return false;
      }
    } else {
      // многоразрядные числа: просто не должно быть отрицательного
      if (answerNum < 0) {
        console.error(
          `❌ Финал ${answerNum} не может быть отрицательным при ${digitCount} разрядах`
        );
        return false;
      }
    }

    // 4. промежуточные состояния не должны ломать физику
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const stateStr = Array.isArray(step.toState)
          ? `[${step.toState.join(", ")}]`
          : step.toState;
        console.error(`❌ Состояние ${stateStr} не валидно`);
        return false;
      }
    }

    // 5. контроль арифметики — применяя шаги, должны получить answer
    let calc = start;
    for (const step of steps) {
      calc = this.applyAction(calc, step.action);
    }
    const calcNum = this.stateToNumber(calc);

    if (calcNum !== answerNum) {
      console.error(`❌ Расчёт ${calcNum} ≠ ответу ${answerNum}`);
      return false;
    }

    console.log(
      `✅ Пример валиден (${this.name}), финал=${answerNum}, разрешённые финалы: ${[0, ...selectedDigits].join(", ")}`
    );
    return true;
  }
}
