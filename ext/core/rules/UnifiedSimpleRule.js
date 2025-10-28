// ext/core/rules/UnifiedSimpleRule.js
//
// Унифицированное правило для режима "Просто"
// (один столбец абакуса без переноса между разрядами).
//
// Главная идея:
// - мы двигаем ОДНУ стойку абакуса;
// - каждый шаг = ОДИН жест ребёнка;
// - жест в "Просто" может:
//     • поднять/опустить только нижние бусины (1..4)
//     • поднять/опустить только верхнюю бусину (5)
//   но не одновременно верхнюю и нижние в рамках одного шага,
//   то есть нет "сразу +7", "+8", "+9", "-7", и т.п.
// - значит допустимые модули шага из физики "Просто": {1,2,3,4,5}.
// - если includeFive=false → нельзя 5.
//
// также:
// - первый шаг всегда положительный;
// - после шага состояние (количество активных бусин) должно быть от 0 до 9;
// - если пользователь выбрал цифры [6,7,8,9] и не выбрал ничего из {1..5},
//   мы автоматически деградируем к разрешённому множеству {1..4,(5?)} чтобы тренажёр не ломался.

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // выбранные пользователем абсолютные шаги
    const userDigitsRaw = Array.isArray(config.selectedDigits)
      ? config.selectedDigits
      : [1, 2, 3, 4];

    // includeFive управляет доступом к верхней бусине
    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        userDigitsRaw.includes(5)) === true;

    // физически возможные величины одного ЖЕСТА в блоке "Просто"
    //  - только нижние бусины: 1..4
    //  - верхняя бусина:      5 (если разрешена)
    const physicallyAllowed = [1, 2, 3, 4, ...(includeFive ? [5] : [])];

    // пересекаем выбор пользователя с физически допустимыми
    let selectedDigits = userDigitsRaw.filter(d =>
      physicallyAllowed.includes(d)
    );

    // fallback: если после фильтрации не осталось действий
    // (например юзер выбрал только 7),
    // нам всё равно нужно генерировать примеры.
    // Тогда используем физическиAllowed как базу.
    if (selectedDigits.length === 0) {
      selectedDigits = physicallyAllowed.slice();
    }

    this.name = "Просто";
    this.description =
      "Тренируем прямые жесты на одной стойке: только нижние бусины (1..4) и/или верхнюю (5)";

    this.config = {
      // состояние стойки: от 0 до 9
      minState: 0,
      maxState: 9,

      // длина примера
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // разрешённые величины ЖЕСТОВ (модули): только 1..4 и возможно 5
      selectedDigits,

      // вспомогательно храним includeFive
      includeFive,
      hasFive: includeFive,

      // методические требования:
      firstActionMustBePositive: true,

      // разрядность
      digitCount: config.digitCount ?? 1,

      // флаги совместимости (многоразрядные режимы и т.д.)
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

      // передаём остальной конфиг
      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule: 
 allowedDigits(one-gesture)=[${this.config.selectedDigits.join(", ")}]
 includeFive=${this.config.includeFive}
 digitCount=${this.config.digitCount}
 minSteps=${this.config.minSteps}
 maxSteps=${this.config.maxSteps}
 firstActionMustBePositive=${this.config.firstActionMustBePositive}
 onlyAddition=${this.config.onlyAddition}
 onlySubtraction=${this.config.onlySubtraction}`
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
   * Стартовое состояние стойки.
   * В режиме "Просто" это всегда 0.
   * Если будет поддержка нескольких разрядов — вернём массив нулей.
   */
  generateStartState() {
    const dc = this.config.digitCount ?? 1;
    if (dc === 1) return 0;
    return Array(dc).fill(0);
  }

  /**
   * Формат шага для UI: +3 / -2
   */
  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    return action >= 0 ? `+${action}` : `${action}`;
  }

  /**
   * Получить текущее значение разряда (0..9) из состояния.
   * currentState может быть одним числом или массивом разрядов.
   */
  getDigitValue(currentState, position = 0) {
    if (Array.isArray(currentState)) {
      return currentState[position] ?? 0;
    }
    return currentState ?? 0;
  }

  /**
   * Применить действие (число или {position,value}) к состоянию.
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
      // один разряд
      const v = this.getDigitValue(currentState, 0);
      return v + action;
    }
  }

  /**
   * Преобразовать состояние в число.
   * Для массива разрядов склеиваем как десятичное число: [ед.,десятки,...].
   */
  stateToNumber(state) {
    if (Array.isArray(state)) {
      // [units, tens, hundreds] -> число
      return state.reduce(
        (sum, digit, index) => sum + digit * Math.pow(10, index),
        0
      );
    }
    return state ?? 0;
  }

  /**
   * Проверка, что состояние валидно:
   * все значения в [minState .. maxState].
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
   * КЛЮЧЕВАЯ ФУНКЦИЯ.
   *
   * Возвращает список допустимых действий (шагов) из текущего состояния,
   * учитывая ФИЗИКУ ОДНОЙ СТОЙКИ в режиме "Просто".
   *
   * currentState: текущее состояние стойки (0..9)
   * isFirstAction: это первый шаг примера?
   * position: индекс разряда (для будущего multi-digit; сейчас 0)
   *
   * Возвращает:
   *  - если digitCount === 1 → массив чисел [ +3, -2, +5, ... ]
   *  - если digitCount > 1   → массив объектов [{position, value}, ...]
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      selectedDigits,
      onlyAddition,
      onlySubtraction,
      digitCount
    } = this.config;

    // текущее значение на этом разряде
    const v = this.getDigitValue(currentState, position);

    // разбираем физику бусин
    // нижние бусины = v % 5 (0..4)
    // верхняя активна? = v >= 5
    const lowerActive = v % 5;      // сколько нижних поднято
    const upperActive = v >= 5;     // верхняя поднята?

    const candidates = [];

    for (const d of selectedDigits) {
      // мы уже гарантировали, что d ∈ {1,2,3,4,5} максимум.
      // генерируем два направления: +d и -d, но фильтруем по физике

      //
      // 1) ПЛЮС (+d)
      //
      if (!onlySubtraction) {
        if (!(isFirstAction === false && onlySubtraction === true)) {
          // физика плюса:
          // a) d = 1..4 (двигаем только нижние)
          //    можем поднять ещё (4 - lowerActive) бусин снизу, не трогая верхнюю
          //    НО если верхняя уже активна (v>=5), то поднятие нижних тоже возможно,
          //    пока не превысим 9 в сумме
          // b) d = 5  (активируем ВЕРХНЮЮ бусину) — только если она не активна
          //    и мы не трогаем нижние в том же жесте.
          //
          let canPlus = false;
          if (d === 5) {
            // +5 = поднять верхнюю. можно только если верхняя не активна.
            if (!upperActive) {
              // После +5 состояние будет v+5.
              // Это всегда <=9 потому что v<=4 когда upperActive=false.
              canPlus = true;
            }
          } else {
            // d = 1..4: "поднять d нижних"
            // cколько свободных нижних бусин доступно?
            const freeLower = 4 - lowerActive; // 0..4
            if (d <= freeLower) {
              // можем чисто добавить d снизу, верхняя не меняется
              // но не должны выйти за пределы 9
              if (v + d <= 9) {
                canPlus = true;
              }
            } else {
              // d больше чем свободно снизу → нельзя в один жест
              canPlus = false;
            }
          }

          if (canPlus) {
            candidates.push(+d);
          }
        }
      }

      //
      // 2) МИНУС (-d)
      //
      if (!onlyAddition) {
        // минус нельзя на первом шаге методически
        if (!isFirstAction) {
          // физика минуса:
          // a) d = 1..4: опустить d нижних (нужно, чтобы нижних было >= d)
          // b) d = 5: опустить верхнюю (только если upperActive=true)
          //    причём это НЕ трогает нижние за один жест.
          //
          let canMinus = false;
          if (d === 5) {
            if (upperActive) {
              // опускаем верхнюю бусину: -5
              canMinus = true;
            }
          } else {
            // d = 1..4: опускаем d нижних бусин
            if (lowerActive >= d) {
              canMinus = true;
            }
          }

          if (canMinus) {
            // после вычитания мы точно не выйдем за 0, так как нельзя снять больше чем есть
            candidates.push(-d);
          }
        }
      }
    }

    // удаляем дубликаты
    const unique = [...new Set(candidates)];

    // если у нас режим с несколькими разрядами (digitCount>1),
    // мы должны возвращать массив объектов { position, value }
    if (digitCount > 1) {
      return unique.map(value => ({ position, value }));
    }

    // лог для отладки
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : String(currentState);

    console.log(
      `⚙️ getAvailableActions(Просто): state=${stateStr}, v=${v}, lower=${lowerActive}, upper=${upperActive} → [${unique.join(
        ", "
      )}]`
    );

    return unique;
  }

  /**
   * Проверка валидности готового примера.
   *
   * Пример:
   * {
   *   start: 0,
   *   steps: [
   *     { action:+3, fromState:0, toState:3 },
   *     { action:+1, fromState:3, toState:4 },
   *     { action:+5, fromState:4, toState:9 },
   *     { action:-5, fromState:9, toState:4 },
   *     { action:-4, fromState:4, toState:0 }
   *   ],
   *   answer: 0
   * }
   *
   * Условия:
   * 1. start = 0 (или массив нулей)
   * 2. первый шаг положительный (>0)
   * 3. каждый промежуточный toState валиден (в пределах 0..9)
   * 4. арифметика сходится (последовательно применяя шаги к start, получаем answer)
   * 5. для одного разряда конечный ответ должен быть
   *    либо 0, либо одной из разрешённых цифр selectedDigits.
   *    (то есть ребёнок заканчивает либо "чисто", либо в одном из разрешённых положений стойки)
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

    // 2. первый шаг >0
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

    // 3. промежуточные состояния валидны
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const st = Array.isArray(step.toState)
          ? `[${step.toState.join(", ")}]`
          : step.toState;
        console.error(
          `❌ Недопустимое состояние ${st} вне диапазона ${minState}..${maxState}`
        );
        return false;
      }
    }

    // 4. арифметика
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

    // 5. финал
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
      // многоразрядный случай: финальное состояние тоже должно быть валидным
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
