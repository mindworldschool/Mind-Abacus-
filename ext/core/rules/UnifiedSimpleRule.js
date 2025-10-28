// core/rules/UnifiedSimpleRule.js
//
// Правило "Просто".
// Главная идея: каждый шаг примера (+N или -N) = один допустимый ЖЕСТ на одной спице абакуса,
// без переносов между разрядами и без "братьев/друзей".
// Мы тренируем только то, что ребёнок реально может сделать рукой за один приём.
//
// Новая физика шага (уточнено методически):
//
// 1. Состояние спицы описываем так:
//    - верхняя бусина (5): активна или нет
//    - нижние бусины (1..1..1..1): каждая может быть активна
//    Значение столбца v = (верхняя ? 5 : 0) + count(активных нижних)
//
// 2. ПЛЮС-ЖЕСТ (сложение):
//    Это жест, в котором мы ТОЛЬКО добавляем активные бусины,
//    не выключая ни одной уже активной.
//    Разрешено сразу поднять ЛЮБОЙ поднабор неактивных бусин за один жест,
//    включая вариант поднять верхнюю и сразу несколько нижних.
//    Пример: из 0 → 7 (верхняя+две нижние сразу) = допустимый один шаг (+7).
//    Пример: из 2 → 9 (была 2 нижние, за жест мы также поднимаем верхнюю и ещё 2 нижние) = +7.
//    НЕЛЬЗЯ делать шаг, где что-то опускаем и что-то поднимаем одновременно.
//    Поэтому, например, 4 → 8 (нужно опустить 1 нижнюю и поднять верхнюю) запрещено.
//
// 3. МИНУС-ЖЕСТ (вычитание):
//    Это жест, в котором мы ТОЛЬКО выключаем уже активные бусины,
//    не активируя никаких новых.
//    Можно опустить любую комбинацию из тех, что сейчас подняты:
//    - только нижние,
//    - только верхнюю,
//    - верхнюю + нижние сразу,
//    - все сразу в 0.
//    Пример: из 7 → 0 = -7 (смахнули всё за один жест).
//
// 4. Нельзя смешивать направления в одном шаге:
//    то есть нельзя одновременно выключить часть и включить другую часть.
//    Это именно то, что отличает режим "Просто" от правил "братья", "через 5".
//
// 5. selectedDigits из настроек говорит,
//    какие абсолютные Δ (1..9) мы вообще разрешаем ребёнку видеть в шагах.
//    Мы фильтруем по ним сгенерированные дельты жестов.
//    Если выбрана одна цифра, напр. [7], мы должны уметь сгенерировать цепочку
//    вида +7 -7 +7 -7 ... . Теперь это поддерживается.
//
// 6. includeFive = можно ли вообще использовать жесты с верхней бусиной.
//    Если includeFive=false, то мы не генерируем жесты, которые поднимают / опускают верхнюю,
//    и также фильтруем дельту ±5 по модулю.
//
// 7. Первый шаг всегда положительный (>0).
//
// 8. Гарантируем, что никакой промежуточный state не выходит за [0..9].
//
// 9. Для одного разряда: финальный ответ должен быть либо 0,
//    либо одна из выбранных цифр из selectedDigits.
//
// Всё это реализовано в getAvailableActions() + validateExample().
//

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
      "Один столбец абакуса. Чистые жесты сложения и вычитания без переходов через 5/10.";

    this.config = {
      // физические пределы одной спицы
      minState: 0,
      maxState: 9,

      // длина примера (кол-во шагов)
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // какие абсолютные величины шага доступны ребёнку методически
      selectedDigits,

      // можно ли использовать верхнюю бусину
      includeFive,
      hasFive: includeFive,

      // важно в "Просто":
      firstActionMustBePositive: true,

      // многоразрядка (генератор уже поддерживает, хотя "Просто" в основном 1 столбец)
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,

      // ограничения направления
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,

      // будущее (братья / друзья / микс)
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // совместимость с остальным кодом
      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

      blocks: config.blocks ?? {},

      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule init:
  digitsAllowed=[${selectedDigits.join(", ")}]
  includeFive=${this.config.includeFive}
  digitCount=${this.config.digitCount}
  minSteps=${this.config.minSteps}
  maxSteps=${this.config.maxSteps}
  onlyAddition=${this.config.onlyAddition}
  onlySubtraction=${this.config.onlySubtraction}
  firstActionMustBePositive=${this.config.firstActionMustBePositive}`
    );
  }

  // ------------------------
  // БАЗОВЫЕ ХЕЛПЕРЫ
  // ------------------------

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

  stateToNumber(state) {
    if (Array.isArray(state)) {
      // [units, tens, hundreds...] -> нормальное десятичное число
      return state.reduce(
        (sum, digit, idx) => sum + digit * Math.pow(10, idx),
        0
      );
    }
    return state ?? 0;
  }

  getDigitValue(currentState, position = 0) {
    if (Array.isArray(currentState)) {
      return currentState[position] ?? 0;
    }
    return currentState ?? 0;
  }

  isValidState(state) {
    const { minState, maxState } = this.config;
    if (Array.isArray(state)) {
      return state.every(v => v >= minState && v <= maxState);
    }
    return state >= minState && state <= maxState;
  }

  applyAction(currentState, action) {
    if (typeof action === "object" && action !== null) {
        // многозначный случай
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

  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    return action >= 0 ? `+${action}` : `${action}`;
  }

  // ------------------------
  // ПРЕДСТАВЛЕНИЕ СОСТОЯНИЯ БУСИН
  // ------------------------

  /**
   * Для значения v (0..9) возвращаем структуру:
   * { upperOn: 0|1, lowers: number }  // lowers = сколько нижних поднято (0..4)
   */
  _splitState(v) {
    if (v >= 5) {
      return {
        upperOn: 1,
        lowers: v - 5
      };
    } else {
      return {
        upperOn: 0,
        lowers: v
      };
    }
  }

  /**
   * Собираем обратно в число.
   */
  _joinState({ upperOn, lowers }) {
    return upperOn * 5 + lowers;
  }

  // ------------------------
  // ГЕНЕРАЦИЯ ДОПУСТИМЫХ СОСТОЯНИЙ ЗА 1 ЖЕСТ
  // ------------------------

  /**
   * Все состояния, куда можно ПРИБАВИТЬ за один жест:
   * - можно активировать ЛЮБОЙ поднабор неактивных бусин
   *   (верхняя и/или несколько нижних),
   * - нельзя выключать уже активные,
   * - если includeFive=false, запрещаем жесты, которые включают верхнюю.
   */
  _enumeratePureAdditionTargets(v, includeFiveFlag) {
    const { upperOn, lowers } = this._splitState(v);
    const results = new Set();

    // перечисляем все варианты "что будет включено после жеста"
    // правило: после жеста:
    //   newUpperOn >= upperOn   (не выключаем верхнюю)
    //   newLowers  >= lowers    (не выключаем нижние)
    //
    // и эти сравнения означают "мы только добавляем".
    //
    // верхняя может стать 1, только если допускается includeFiveFlag
    // если includeFiveFlag=false и верхняя сейчас 0,
    // запрещаем варианты, где newUpperOn=1
    //
    for (let newUpperOn of [0, 1]) {
      // не выключаем верхнюю:
      if (newUpperOn < upperOn) continue;

      // если мы хотим поднять верхнюю, но методически нельзя трогать 5:
      if (newUpperOn === 1 && upperOn === 0 && !includeFiveFlag) {
        continue;
      }

      for (let newLowers = lowers; newLowers <= 4; newLowers++) {
        // не выключаем нижние: newLowers < lowers запрещено
        // уже отфильтровано выше через старт цикла

        const candidate = { upperOn: newUpperOn, lowers: newLowers };
        const candidateVal = this._joinState(candidate);

        if (candidateVal !== v) {
          results.add(candidateVal);
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Все состояния, куда можно УБАВИТЬ за один жест:
   * - можно выключить ЛЮБОЙ поднабор тех бусин, что сейчас активны,
   * - нельзя активировать новые.
   *
   * То есть после жеста:
   *   newUpperOn <= upperOn
   *   newLowers  <= lowers
   *
   * Если includeFive=false и верхняя была активна (upperOn=1),
   * мы всё равно МОЖЕМ её опустить (это минус, это не запрещено),
   * т.к. includeFive управляет использованием верхней как инструмента сложения.
   * Снять верхнюю при вычитании — это допустимо, потому что ребёнок её "убирает".
   */
  _enumeratePureRemovalTargets(v) {
    const { upperOn, lowers } = this._splitState(v);
    const results = new Set();

    for (let newUpperOn = 0; newUpperOn <= upperOn; newUpperOn++) {
      for (let newLowers = 0; newLowers <= lowers; newLowers++) {
        const candidate = { upperOn: newUpperOn, lowers: newLowers };
        const candidateVal = this._joinState(candidate);

        if (candidateVal !== v) {
          results.add(candidateVal);
        }
      }
    }

    return Array.from(results);
  }

  /**
   * Итог: все допустимые next-состояния за один жест "Просто" из текущего v.
   * Мы считаем отдельно "+"-жесты (только добавление) и "-" жесты (только снятие),
   * а потом объединяем.
   */
  _enumeratePhysicalNextStates(v, includeFiveFlag) {
    const plusTargets = this._enumeratePureAdditionTargets(
      v,
      includeFiveFlag
    );
    const minusTargets = this._enumeratePureRemovalTargets(v);

    // Объединяем
    const merged = new Set();
    for (const nxt of plusTargets) merged.add(nxt);
    for (const nxt of minusTargets) merged.add(nxt);

    // Текущее состояние само по себе не нужно
    merged.delete(v);

    return Array.from(merged);
  }

  // ------------------------
  // ДОСТУПНЫЕ ДЕЙСТВИЯ (Δ) ДЛЯ ГЕНЕРАТОРА
  // ------------------------

  /**
   * Возвращает список допустимых действий из текущего состояния по данной позиции.
   *
   * Алгоритм:
   * 1. Берём текущее значение v.
   * 2. Генерируем все физически возможные next состояния за 1 жест
   *    с учётом includeFive.
   * 3. Для каждого считаем delta = next - v.
   * 4. Фильтруем:
   *    - первый шаг не может быть минусом,
   *    - onlyAddition / onlySubtraction,
   *    - по выбранным цифрам selectedDigits (|delta| ∈ selectedDigits),
   *    - если includeFive=false, мы уже не создавали плюсы,
   *      которые поднимают верхнюю, но минусы с верхней вниз оставляем.
   * 5. Если digitCount>1 → маппим в { position, value }.
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      digitCount,
      selectedDigits,
      includeFive,
      onlyAddition,
      onlySubtraction
    } = this.config;

    const v = this.getDigitValue(currentState, position);

    // шаг 1-2: найти физически достижимые next стейты
    const possibleNextStates = this._enumeratePhysicalNextStates(
      v,
      includeFive
    );

    // шаг 3: превращаем в дельты
    let deltas = possibleNextStates.map(nextV => nextV - v);

    // шаг 4a: правило направления тренировки
    deltas = deltas.filter(delta => {
      if (onlyAddition && delta < 0) return false;
      if (onlySubtraction && delta > 0) return false;
      return true;
    });

    // шаг 4b: первый шаг не может быть минусом
    if (isFirstAction) {
      deltas = deltas.filter(delta => delta > 0);
    }

    // шаг 4c: фильтр по выбранным цифрам
    deltas = deltas.filter(delta => {
      const absVal = Math.abs(delta);
      return selectedDigits.includes(absVal);
    });

    // убираем повторы
    deltas = Array.from(new Set(deltas));

    // шаг 5: многоразрядный случай возвращает {position,value}
    if (digitCount > 1) {
      return deltas.map(value => ({ position, value }));
    }

    // лог для отладки
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;
    console.log(
      `⚙️ getAvailableActions(physical+combinational): state=${stateStr}, pos=${position}, v=${v} → [${deltas.join(
        ", "
      )}]`
    );

    return deltas;
  }

  // ------------------------
  // ВАЛИДАЦИЯ СГЕНЕРИРОВАННОГО ПРИМЕРА
  // ------------------------

  /**
   * Проверяем пример целиком.
   *
   * Пример формата:
   * {
   *   start: 0,
   *   steps: [
   *     { action:+7, fromState:0, toState:7 },
   *     { action:-7, fromState:7, toState:0 },
   *     { action:+7, fromState:0, toState:7 },
   *   ],
   *   answer: 7
   * }
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { digitCount, selectedDigits, minState, maxState } = this.config;

    // 1. старт = 0
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Стартовое состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. первый шаг должен быть плюсом
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

    // 3. все промежуточные состояния должны быть в допустимом коридоре
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const st = Array.isArray(step.toState)
          ? `[${step.toState.join(", ")}]`
          : step.toState;
        console.error(
          `❌ Состояние ${st} вне диапазона ${minState}..${maxState}`
        );
        return false;
      }
    }

    // 4. арифметика: start + все action = answer
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

    // 5. финал для одного разряда должен быть "0 или обучаемая цифра"
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
      // многоразрядный случай — просто проверяем диапазон
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
      `✅ Пример валиден (${this.name}): финал=${answerNum}, разрешённые финалы = 0 или {${selectedDigits.join(
        ", "
      )}}`
    );
    return true;
  }
}
