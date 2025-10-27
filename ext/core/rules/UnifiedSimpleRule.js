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
//    "подними верхнюю, опусти нижние и т.д.".
//    Для ученика это один шаг.
//    Значит шаг может быть 1..9 по модулю, в том числе 6,7,8,9.
// 4. Ограничение физики: после каждого шага текущее значение разряда
//    обязано оставаться в диапазоне 0..9 (одна спица = максимум 9).
//    То есть мы запрещаем ходы, которые уводят ниже 0 или выше 9.
// 5. Список разрешённых абсолютных значений шага задаётся настройками (selectedDigits).
//    Если выбраны только [3], пример будет типа +3 -3 +3 -3.
//    Если выбраны [2,5,7], возможны +2, -2, +5, -5, +7, -7.
// 6. Мы уважаем флаги onlyAddition / onlySubtraction:
//    - onlyAddition: разрешаем только плюсы;
//    - onlySubtraction: только минусы (НО всё равно первый шаг должен быть плюсом — см. ниже).
// 7. Мы НЕ навязываем "через 5", "друзья 10", "братья" — это другие режимы.
//
//
// Что делает класс:
//
// - хранит конфиг правила (selectedDigits, ограничения шагов и т.д.).
// - даёт getAvailableActions(currentState, isFirstAction) → массив шагов [+3, -2, ...]
//   которые можно применить к текущему состоянию не нарушая физики (0..9),
//   и соблюдая методические ограничения (первый шаг не может быть минусом).
// - даёт validateExample(example) чтобы финальная цепочка считалась валидной
//   по нашей методике.

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // 1. Какие цифры выбраны в блоке «Просто»
    // Это разрешённые абсолютные дельты шага: [1,2,3,4,5,6,7,8,9] или подмножество.
    // Каждый шаг в примере будет +d или -d, где d ∈ selectedDigits.
    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];

    // 2. Наличие "пятёрки" (верхней бусины) нам теперь НЕ нужно
    //    для ограничения шагов. Любые цифры 1..9 могут быть шагом,
    //    если они есть в selectedDigits и не ломают диапазон.
    //
    //    Но мы оставим includeFive в конфиге, чтобы не рвать контракт
    //    с остальным кодом (UI может продолжать передавать этот флаг).
    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    this.name = "Просто";
    this.description = "Тренируем прямые плюсы и минусы на одном разряде без переноса";

    // 3. Финальная конфигурация правила
    this.config = {
      // физические пределы для ОДНОГО разряда
      minState: 0,
      maxState: 9, // всегда 0..9, мы больше не делим "только нижние" vs "с верхней"

      // ограничения длины примера (кол-во шагов в цепочке)
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // разрешённые абсолютные значения шага
      selectedDigits,

      // статус "пятёрки" оставляем чисто для совместимости с UI/логами
      includeFive,
      hasFive: includeFive,

      // требование методики
      // 1) старт всегда из 0
      // 2) первый шаг не может быть минусом
      firstActionMustBePositive: true,

      // многоразрядность: сейчас мы считаем основной кейс = один разряд
      digitCount: config.digitCount ?? 1,

      // combineLevels / brothers / friends / mix и т.д.
      // оставляем, чтобы не падал внешний код, но здесь НЕ используем
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // остальное прокидываем как есть
      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule (новая логика "Просто"):
  digitsAllowed=[${selectedDigits.join(", ")}]
  digitCount=${this.config.digitCount}
  minSteps=${this.config.minSteps}
  maxSteps=${this.config.maxSteps}
  onlyAddition=${this.config.onlyAddition}
  onlySubtraction=${this.config.onlySubtraction}
  firstActionMustBePositive=${this.config.firstActionMustBePositive}`
    );
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
   * к состоянию currentState. Ожидается, что наружный код этим пользуется
   * при построении шагов и валидации.
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
   * Преобразовать состояние (число или массив) в одно число для проверки финала.
   * Для многоразрядного варианта здесь можно сделать слияние в целое число,
   * но в базовом "Просто" digitCount=1 и это просто значение [0..9].
   */
  stateToNumber(state) {
    if (Array.isArray(state)) {
      // простой способ: трактуем массив разрядов как десятичное число
      // [A,B,C] => A*100 + B*10 + C
      // но по умолчанию у нас digitCount=1, так что это редко используется
      return state.reduce((acc, digit) => acc * 10 + digit, 0);
    }
    return state ?? 0;
  }

  /**
   * Проверка "состояние валидно?"
   * В новой логике валидность = каждый разряд в пределах 0..9.
   */
  isValidState(state) {
    if (Array.isArray(state)) {
      return state.every(v => v >= this.config.minState && v <= this.config.maxState);
    }
    return state >= this.config.minState && state <= this.config.maxState;
  }

  /**
   * Основная функция: какие ходы (+N / -N) мы МОЖЕМ сделать сейчас.
   *
   * Важные правила:
   *  - шаг = целое число со знаком, например +3 или -7;
   *  - |шаг| (модуль шага) должен быть в this.config.selectedDigits;
   *  - после применения шага состояние не должно выйти за пределы [0..9];
   *  - если это ПЕРВЫЙ шаг в примере (isFirstAction === true),
   *    то шаг не может быть отрицательным;
   *  - если onlyAddition === true → разрешаем только плюсы;
   *    если onlySubtraction === true → только минусы
   *    (но если это первый шаг и onlySubtraction, всё равно шаг должен быть плюсом,
   *     иначе ты не сможешь сдвинуться с нуля).
   *
   * Возвращаем массив чисел, например [+3, -2, +7].
   *
   * @param {number|number[]} currentState текущее состояние (0..9 или массив разрядов)
   * @param {boolean} isFirstAction это первый шаг в примере?
   * @param {number} position индекс столбца (обычно 0, работаем с единицами)
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      selectedDigits,
      minState,
      maxState,
      onlyAddition,
      onlySubtraction,
      digitCount
    } = this.config;

    // Берём значение конкретного разряда
    const v = this.getDigitValue(currentState, position);

    // Набор возможных шагов
    const deltas = new Set();

    for (const d of selectedDigits) {
      const plus = +d;
      const minus = -d;

      // Кандидат: +d
      if (!onlySubtraction) {
        // первый шаг может быть плюсом ✅
        const afterPlus = v + plus;
        if (
          afterPlus >= minState &&
          afterPlus <= maxState
        ) {
          deltas.add(plus);
        }
      }

      // Кандидат: -d
      if (!onlyAddition) {
        // минус НЕЛЬЗЯ, если это первый шаг
        if (!isFirstAction) {
          const afterMinus = v + minus;
          if (
            afterMinus >= minState &&
            afterMinus <= maxState
          ) {
            deltas.add(minus);
          }
        }
      }
    }

    const resultDeltas = Array.from(deltas);

    // Если у нас многоразрядный режим (digitCount > 1),
    // мы должны вернуть массив объектов { position, value },
    // чтобы генератор мог применить шаг к конкретной колонке.
    if (digitCount > 1) {
      return resultDeltas.map(value => ({ position, value }));
    }

    // Иначе (один разряд) возвращаем просто числа
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;

    console.log(
      `⚙️ getAvailableActions(simple v3): state=${stateStr}, pos=${position}, v=${v} → [${resultDeltas.join(", ")}]`
    );

    return resultDeltas;
  }

  /**
   * Проверка валидности готового примера.
   *
   * Пример должен выглядеть примерно так:
   * {
   *   start: 0,
   *   steps: [
   *     { action: +3, toState: 3 },
   *     { action: +1, toState: 4 },
   *     { action: +5, toState: 9 },
   *     { action: -7, toState: 2 },
   *     { action: +6, toState: 8 },
   *     { action: -8, toState: 0 }
   *   ],
   *   answer: 0
   * }
   *
   * Условия валидности:
   *
   * 1. start должен быть 0 (или [0,...]) → мы всегда стартуем с пустого абакуса.
   *
   * 2. Первый шаг (steps[0].action) должен быть >0.
   *    То есть первый ход не может быть минусом.
   *
   * 3. Каждый промежуточный toState должен быть валидным состоянием
   *    (0..9 для каждого разряда), не вылетать за пределы.
   *
   * 4. Последовательно применяя action по шагам к start,
   *    мы должны прийти к answer.
   *
   * 5. Для одного разряда (digitCount === 1):
   *    Конечный ответ должен быть либо 0,
   *    либо одной из выбранных цифр selectedDigits.
   *    Примеры:
   *      selectedDigits = [1..9] → финал может быть 0..9
   *      selectedDigits = [3]     → финал может быть 0 или 3
   *      selectedDigits = [2,5]   → финал может быть 0,2,5
   *
   *    Это наш новый методический критерий вместо "ответ ≤5".
   *
   * 6. Для многоразрядного режима (digitCount > 1):
   *    запрещаем отрицательные значения в любом разряде,
   *    но строгих ограничений на финал по selectedDigits не накладываем сейчас.
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

    // 2. первый шаг должен быть плюсом (>0)
    if (steps.length > 0) {
      // steps[i].action может быть числом или объектом {position,value}
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
        console.error(`❌ Состояние ${stateStr} вне диапазона ${minState}..${maxState}`);
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
      console.error(`❌ Пересчёт ${calcNum} ≠ заявленному answer ${answerNum}`);
      return false;
    }

    // 5. проверка финального ответа
    if (digitCount === 1) {
      const allowedFinals = new Set([0, ...selectedDigits]);
      if (!allowedFinals.has(answerNum)) {
        console.error(
          `❌ Финальный ответ ${answerNum} не входит в {0, ${selectedDigits.join(", ")}}`
        );
        return false;
      }
    } else {
      // многоразрядный случай: проверяем, что каждый разряд в допустимых границах
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
      `✅ Пример валиден (${this.name}): финал=${answerNum}, разрешённые финалы {0, ${selectedDigits.join(", ")}}`
    );
    return true;
  }
}
