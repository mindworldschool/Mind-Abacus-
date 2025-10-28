// ext/core/rules/UnifiedSimpleRule.js
//
// Унифицированное правило для тренировки "Просто" (один столбец абакуса без переноса).
//
// Главные методические принципы:
//
// 1. Старт всегда из 0 (все бусины неактивны). Ноль не показываем.
// 2. Первый шаг всегда положительный (+N). Нельзя начать с минуса из пустой стойки.
// 3. Каждый шаг — одно целое со знаком (+3, -4, +7 ...).
//    Для ребёнка это один жест, а не формула типа "через 5".
// 4. Мы разрешаем ТОЛЬКО физически допустимые жесты на текущей стойке,
//    без переконфигураций (нельзя одновременно убирать одни бусины и поднимать другие,
//    если это не один допустимый жест блока «Просто»).
// 5. Список разрешённых |дельт| задаётся selectedDigits. Если разрешено только [1,2,3,4],
//    то не появится шаг +7.
// 6. Флаг includeFive управляет доступом к верхней бусине (5):
//    - includeFive = false → режим «Просто 4»: стойка живёт в диапазоне 0..4,
//      верхняя бусина вообще не используется;
//    - includeFive = true  → режим «Просто 5»: можно активировать верхнюю, жить в 0..9,
//      разрешаются жесты с верхней.
// 7. Мы не делаем «братьев», «друзей», «через 5» и т.п. — это будут отдельные правила.

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // 1. Какие цифры разрешены в блоке «Просто»
    // Это абсолютные величины шагов: [1,2,3,4,5,6,7,8,9] или подмножество.
    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];

    // 2. Можно ли использовать верхнюю бусину (5)?
    // includeFive = false → чисто нижние бусины (макс =4)
    // includeFive = true  → можно верхнюю (макс =9)
    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    // maxState зависит от includeFive:
    //  - без верхней: стойка не должна вообще уходить в состояния 5..9
    //  - с верхней: можно вплоть до 9
    const maxStateAllowed = includeFive ? 9 : 4;

    this.name = "Просто";
    this.description =
      "Тренируем прямые плюсы и минусы на одном разряде без переноса";

    // 3. Финальная конфигурация
    this.config = {
      // физические пределы для ОДНОГО разряда
      minState: 0,
      maxState: maxStateAllowed,

      // длина цепочки
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // какие абсолютные шаги можно показывать
      selectedDigits,

      // доступ к верхней бусине (5)
      includeFive,
      hasFive: includeFive, // для старого кода, чтоб не падал

      // методические требования
      // 1) старт всегда из 0
      // 2) первый шаг не минус
      firstActionMustBePositive: true,

      // многоразрядность (на будущее)
      digitCount: config.digitCount ?? 1,

      // флаги-совместимость
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // совместимость/на будущее
      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

      // сохраним остальное
      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule (физика "Просто"):
  digitsAllowed=[${selectedDigits.join(", ")}]
  includeFive=${this.config.includeFive}
  maxState=${this.config.maxState}
  digitCount=${this.config.digitCount}
  minSteps=${this.config.minSteps}
  maxSteps=${this.config.maxSteps}
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
      // многоразрядный случай: {position, value}
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
      return state.every(v => v >= minState && v <= maxState);
    }
    return state >= minState && state <= maxState;
  }

  /**
   * Сгенерировать допустимые шаги (+N / -N) из текущего состояния одного разряда.
   *
   * Важное:
   *  - мы моделируем ФИЗИКУ стойки;
   *  - мы не разрешаем "пересборку" бусин (это уже другие блоки типа "братья");
   *  - мы фильтруем по методике: первый шаг не минус, onlyAddition / onlySubtraction и т.д.;
   *  - шаг по модулю обязан входить в selectedDigits;
   *  - если includeFive=false, шаг ±5 вообще запрещён.
   *
   * Возвращаем:
   *   digitCount === 1 → массив чисел [ +3, -2, +4, ... ]
   *   digitCount  > 1 → массив объектов [{position,value}, ...]
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

    // текущее значение стойки (0..9)
    const v = this.getDigitValue(currentState, position);

    // активна ли верхняя бусина сейчас
    const upperActive = includeFive && v >= 5;

    // сколько нижних бусин поднято сейчас (0..4)
    const lowerCount = upperActive ? (v - 5) : v;

    // возможные следующие состояния стойки после одного допустимого жеста
    const targets = new Set();

    //
    // ===== ДОПУСТИМЫЕ ПЛЮСЫ =====
    //
    if (!onlySubtraction) {
      if (!upperActive) {
        // верхняя НЕ активна (мы в зоне 0..4)

        // (A) можно просто поднять ещё нижние бусины:
        // v -> v+1 .. 4
        for (let next = v + 1; next <= 4; next++) {
          // это чистое "добавил одну-две-три нижние"
          if (next >= minState && next <= maxState) {
            targets.add(next);
          }
        }

        // (B) если верхняя бусина методически разрешена,
        // можно одним жестом поднять её целиком,
        // не убирая уже поднятые нижние:
        // v -> v+5 (0->5,1->6,4->9)
        if (includeFive) {
          const next = v + 5;
          if (next >= minState && next <= maxState) {
            targets.add(next);
          }
        }

        // ❗ Мы НЕ разрешаем "пересборку" вроде 4 -> 7 как «+3»,
        // где надо было бы опустить часть нижних и поднять верхнюю.
        // Это не блок "Просто".
      } else {
        // верхняя УЖЕ активна (мы в зоне 5..9)
        // можно добирать оставшиеся нижние вверх:
        // v -> v+1 .. 9
        for (let next = v + 1; next <= 9; next++) {
          if (next >= minState && next <= maxState) {
            targets.add(next);
          }
        }
      }
    }

    //
    // ===== ДОПУСТИМЫЕ МИНУСЫ =====
    //
    if (!onlyAddition) {
      if (!upperActive) {
        // верхняя НЕ активна (0..4)
        // можно опускать нижние частично или полностью:
        // v -> v-1 .. 0
        for (let next = v - 1; next >= 0; next--) {
          if (next >= minState && next <= maxState) {
            targets.add(next);
          }
        }
      } else {
        // верхняя активна (5..9)

        // (A) можно опускать только нижние, сохраняя верхнюю:
        // v -> v-1 .. 5
        for (let next = v - 1; next >= 5; next--) {
          if (next >= minState && next <= maxState) {
            targets.add(next);
          }
        }

        // (B) можно снять только верхнюю бусину целиком,
        // оставив нижние поднятыми как были (пример: 7(5+2) → 2):
        const dropUpper = lowerCount;
        if (dropUpper >= minState && dropUpper <= maxState) {
          targets.add(dropUpper);
        }

        // (C) можно снять всё:
        // v -> 0
        if (0 >= minState && 0 <= maxState) {
          targets.add(0);
        }
      }
    }

    //
    // Теперь превращаем возможные целевые состояния в дельты
    //
    let deltas = [];
    for (const next of targets) {
      if (next === v) continue; // бессмысленный ноль

      const delta = next - v;
      const absDelta = Math.abs(delta);

      // первое действие не может быть минусом
      if (isFirstAction && delta < 0) continue;

      // фильтр по направлению
      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;

      // модуль дельты должен быть разрешённой цифрой
      if (!selectedDigits.includes(absDelta)) continue;

      // если пятёрка выключена → выкидываем чистые ±5
      if (absDelta === 5 && !includeFive) continue;

      deltas.push(delta);
    }

    // убираем дубли
    deltas = [...new Set(deltas)];

    // если работаем с несколькими разрядами → вернуть {position,value}
    if (digitCount > 1) {
      return deltas.map(value => ({ position, value }));
    }

    // одноразрядный случай: вернуть обычные числа
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;

    console.log(
      `⚙️ getAvailableActions(strict physics): state=${stateStr}, pos=${position}, v=${v} → [${deltas.join(
        ", "
      )}]`
    );

    return deltas;
  }

  /**
   * Валидация готового примера.
   *
   * Пример:
   * {
   *   start: 0,
   *   steps: [
   *     { action:+3, fromState:0, toState:3 },
   *     { action:+1, fromState:3, toState:4 },
   *     { action:-4, fromState:4, toState:0 },
   *   ],
   *   answer: 0
   * }
   *
   * Условия:
   * 1. start должен быть 0 (или [0,...]).
   * 2. Первый шаг обязательно >0.
   * 3. Каждое промежуточное состояние toState валидно (в пределах minState..maxState).
   * 4. Если последовательно применить все action к start,
   *    мы должны получить answer.
   * 5. Для одного разряда:
   *    - финальный ответ должен быть 0
   *      или одной из разрешённых цифр selectedDigits.
   *    Это: {0, ...selectedDigits}.
   * 6. Для многоразрядного варианта:
   *    - просто никакой разряд не должен выйти за 0..9
   *      (у нас maxState уже учитывает includeFive).
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { digitCount, selectedDigits, minState, maxState } = this.config;

    // 1. старт должен быть ноль
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Стартовое состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. проверяем, что первый шаг положительный
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

    // 3. проверяем все промежуточные состояния
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

    // 4. пересчёт арифметики
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
      // многоразрядный случай: просто проверяем валидность набора
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
