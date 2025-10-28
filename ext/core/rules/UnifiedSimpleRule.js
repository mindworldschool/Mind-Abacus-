// ext/core/rules/UnifiedSimpleRule.js
//
// Унифицированное правило для тренировки "Просто".
//
// Главная идея:
//  - мы работаем в рамках ОДНОГО столбца абакуса без переноса,
//    физика реальная, никакой магии "через 5"/"через 10";
//  - стартуем всегда с 0;
//  - первый шаг всегда плюс;
//  - каждый шаг — это одно физическое движение руки, т.е. сразу +N или -N;
//  - |N| должен быть из выбранных цифр в блоке «Просто»;
//  - состояние спицы после каждого шага не может выходить за 0..9;
//  - доступность шага определяется текущим положением бусин,
//    а не просто арифметикой.
//
// Очень важно: доступность +N и -N зависит от того,
// активна ли верхняя косточка (=5) сейчас в этом столбце,
// и можем ли мы сделать это одним жестом без формул.

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // Какие цифры разрешены в блоке "Просто"
    // (шаги могут быть только ±эти_цифры)
    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];

    // Можно ли использовать верхнюю бусину (5)
    // Если false — любые шаги с модулем 5 запрещаются.
    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    this.name = "Просто";
    this.description =
      "Последовательность шагов на одной спице абакуса без переноса и без формул";

    this.config = {
      // физические пределы для одного разряда
      minState: 0,
      maxState: 9, // максимум 9 на одной спице (верхняя + все нижние)

      // длина примера
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // разрешённые абсолютные шаги
      selectedDigits,

      // разрешена ли работа с верхней косточкой (жесты ±5)
      includeFive,
      hasFive: includeFive,

      // методические требования
      firstActionMustBePositive: true,

      // многоразрядность (сейчас чаще digitCount=1)
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,

      // ограничение направлений
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,

      // "братья", "друзья", "микс" — просто пробрасываем пока
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // совместимость
      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

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

  /**
   * Сколько шагов будет в примере:
   * случайно между minSteps и maxSteps (включительно).
   */
  generateStepsCount() {
    const min = this.config.minSteps ?? 2;
    const max = this.config.maxSteps ?? min;
    if (min === max) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /**
   * Стартовое состояние.
   * Для одного столбца: 0.
   * Для нескольких столбцов: массив нулей.
   */
  generateStartState() {
    const dc = this.config.digitCount ?? 1;
    if (dc === 1) return 0;
    return Array(dc).fill(0);
  }

  /**
   * Форматирование действия для вывода (+3, -7)
   */
  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    return action >= 0 ? `+${action}` : `${action}`;
  }

  /**
   * Значение одного разряда (0..9) из числа или массива разрядов.
   */
  getDigitValue(currentState, position = 0) {
    if (Array.isArray(currentState)) {
      return currentState[position] ?? 0;
    }
    return currentState ?? 0;
  }

  /**
   * Применение шага к состоянию.
   * action может быть числом (один разряд)
   * или объектом { position, value } (для многозначного).
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
   * Преобразовать состояние в число для вывода/валидации.
   * Если массив разрядов — склеиваем в десятичное число.
   */
  stateToNumber(state) {
    if (Array.isArray(state)) {
      // [единицы, десятки, сотни] -> число
      // пример: [3,1] => 13
      return state.reduce(
        (sum, digit, index) => sum + digit * Math.pow(10, index),
        0
      );
    }
    return state ?? 0;
  }

  /**
   * Проверка валидности состояния.
   * Просто проверяем, что каждая цифра в пределах [0..9].
   */
  isValidState(state) {
    const { minState, maxState } = this.config;

    if (Array.isArray(state)) {
      return state.every(v => v >= minState && v <= maxState);
    }
    return state >= minState && state <= maxState;
  }

  /**
   * КЛЮЧЕВАЯ ФУНКЦИЯ:
   * Возвращает список допустимых действий (+N / -N) ИМЕННО СЕЙЧАС
   * из текущего состояния разряда с учётом физики абакуса.
   *
   * Логика физики:
   *
   * Пусть v = текущее значение спицы (0..9).
   *
   * Случай v < 5 (верхняя бусина не активна):
   *  - ПЛЮС:
   *      можно только поднимать недостающие нижние бусины,
   *      то есть v -> v+1 .. 4 (если это разрешённый шаг)
   *      + отдельный жест "поднять верхнюю целиком":
   *        v -> v+5 (0→5, 2→7, 4→9), если includeFive=true и шаг=5 разрешён
   *        ВАЖНО: это именно "добавить верхнюю поверх уже поднятых нижних",
   *        мы НЕ делаем реформацию через 5 (не опускаем нижние).
   *
   *  - МИНУС:
   *      можно опускать часть/все нижние:
   *      v -> v-1 .. 0
   *
   * Случай v >= 5 (верхняя бусина активна):
   *  - ПЛЮС:
   *      можно только добирать ещё нижние бусины, пока не 9:
   *      v -> v+1 .. 9
   *
   *  - МИНУС:
   *      (1) можно снимать нижние частично, не трогая верхнюю:
   *          v -> v-1 .. 5
   *      (2) можно снять верхнюю целиком, оставив только нижние:
   *          v=5+k -> k  (это -5)
   *      (3) можно снять всё:
   *          v -> 0 (это -v)
   *
   * Дальше мы фильтруем:
   *  - шаг по модулю должен быть в selectedDigits,
   *  - на первом шаге не можем давать минус,
   *  - уважаем onlyAddition / onlySubtraction,
   *  - если |шаг| = 5, а includeFive=false → нельзя,
   *  - новое состояние не должно выйти за 0..9.
   *
   * Возвращаем:
   *   - для одного разряда: массив чисел [+3, -2, ...]
   *   - для нескольких разрядов: массив объектов { position, value }
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      selectedDigits,
      includeFive,
      onlyAddition,
      onlySubtraction,
      digitCount
    } = this.config;

    const v = this.getDigitValue(currentState, position);

    // Собираем все возможные конечные состояния next (число 0..9),
    // которые можно достичь ОДНИМ жестом из текущего положения v.
    const reachableTargets = new Set();

    if (v < 5) {
      // ТОЛЬКО нижние бусины активны

      // ПЛЮС: добираем нижние, но не больше 4
      if (!onlySubtraction) {
        for (let next = v + 1; next <= 4; next++) {
          reachableTargets.add(next);
        }

        // ПЛЮС: поднять верхнюю целиком поверх текущего состояния
        // v -> v+5 (0→5,1→6,2→7,3→8,4→9)
        if (includeFive) {
          const next = v + 5;
          if (next <= 9) {
            reachableTargets.add(next);
          }
        }
      }

      // МИНУС: опускать нижние частично или полностью
      if (!onlyAddition) {
        for (let next = v - 1; next >= 0; next--) {
          reachableTargets.add(next);
        }
      }
    } else {
      // v >= 5 → верхняя бусина активна

      // ПЛЮС: можно добирать ещё нижние, пока не 9
      if (!onlySubtraction) {
        for (let next = v + 1; next <= 9; next++) {
          reachableTargets.add(next);
        }
      }

      // МИНУС блок
      if (!onlyAddition) {
        // (1) опускать часть нижних, верхняя остаётся
        for (let next = v - 1; next >= 5; next--) {
          reachableTargets.add(next);
        }

        // (2) снять верхнюю целиком, оставить только нижние k
        // v = 5 + k  -> next = k   (дельта = -5)
        const lowerOnly = v - 5;
        // Мы всегда можем физически это сделать рукой.
        // Но потом мы всё равно отфильтруем дельту по selectedDigits.
        reachableTargets.add(lowerOnly);

        // (3) снять ВСЁ одним жестом → 0
        reachableTargets.add(0);
      }
    }

    //
    // Теперь превращаем конечные состояния next в реальную дельту (next - v)
    // и фильтруем по методическим правилам.
    //
    const deltas = new Set();

    for (const next of reachableTargets) {
      if (next === v) continue; // нет нулевого шага

      const delta = next - v;
      const absDelta = Math.abs(delta);

      // первый шаг не может быть минусом
      if (isFirstAction && delta < 0) continue;

      // уважаем ограничения направления
      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;

      // шаг по модулю должен быть разрешён
      if (!selectedDigits.includes(absDelta)) continue;

      // ±5 запрещаем, если includeFive=false
      if (absDelta === 5 && !includeFive) continue;

      // финальная страховка по диапазону
      const after = v + delta;
      if (after < 0 || after > 9) continue;

      deltas.add(delta);
    }

    const resultDeltas = Array.from(deltas);

    // Многозначный вариант: оборачиваем как { position, value }
    if (digitCount > 1) {
      return resultDeltas.map(value => ({ position, value }));
    }

    // Одноразрядный вариант: просто числа
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;
    console.log(
      `⚙️ getAvailableActions(phys): v=${v}, state=${stateStr} -> [${resultDeltas.join(
        ", "
      )}]`
    );

    return resultDeltas;
  }

  /**
   * Валидация сгенерированного примера.
   *
   * Пример формата:
   * {
   *   start: 0,
   *   steps: [
   *     { action:+3, fromState:0, toState:3 },
   *     { action:+1, fromState:3, toState:4 },
   *     { action:-4, fromState:4, toState:0 },
   *     ...
   *   ],
   *   answer: 0
   * }
   *
   * Требования:
   * 1. start должен быть 0 (или [0,...]).
   * 2. первый шаг > 0 (нельзя начинать с минуса).
   * 3. каждый промежуточный toState валиден (0..9 в каждом разряде).
   * 4. арифметика шагов действительно приводит к answer.
   * 5. если digitCount === 1:
   *      итог должен быть либо 0,
   *      либо одним из разрешённых selectedDigits.
   *    (т.е. ребёнок видит только те ответы, с которыми он реально тренируется)
   * 6. если digitCount > 1:
   *      просто запрещаем отрицательные и >9 разряды.
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { digitCount, selectedDigits, minState, maxState } = this.config;

    // 1. старт всегда должен быть ноль
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Стартовое состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. первый шаг обязан быть плюсом
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

    // 3. промежуточные состояния должны быть валидны физически
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

    // 4. арифметика цепочки
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

    // 5. финальный ответ допустим?
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
      // многоразрядный случай:
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
