// ext/core/rules/UnifiedSimpleRule.js
//
// Правило для блока "Просто":
//  - работаем на одной стойке абакуса без переноса
//  - каждый шаг = один физический жест ребёнка
//  - жест МОЖЕТ одновременно менять верхнюю бусину (5) и любое количество нижних бусин (1..4)
//    => допустимы шаги 1..9 за один шаг (+6, +7, +8, +9 в том числе)
//  - но шаг разрешён только если из текущего состояния можно получить новое состояние одним жестом
//    и не выйти за диапазон 0..9
//
// Важные методические правила:
//  - первый шаг не может быть минусом
//  - если пользователь выбрал только одну цифру (например 7), тренажёр должен строить цепочки типа +7 -7 +7 ...
//  - если includeFive=false и цифры только в диапазоне 1..4, мы вообще не используем верхнюю бусину
//  - НО если пользователь выбрал хоть одну цифру >=5, то по смыслу это значит "мы разрешаем верхнюю бусину",
//    даже если UI флажок includeFive не поставил. Иначе генерация бы просто не работала.
//

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // 1. Что реально выбрал пользователь
    const rawDigits = Array.isArray(config.selectedDigits)
      ? config.selectedDigits
      : [1, 2, 3, 4];

    // 2. Базовое понимание includeFive из настроек UI
    let includeFiveFlag =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        rawDigits.includes(5)) === true;

    // 2.1. Если ребёнок выбрал хоть одну цифру >=5,
    // это физически означает "мы работаем с верхней бусиной".
    // Даже если флажок includeFive формально выключен —
    // без верхней мы НЕ можем сделать, например, +7.
    // Значит, чтобы генерация не ломалась, мы насильно разрешаем верхнюю.
    if (rawDigits.some(n => Number.isFinite(n) && n >= 5)) {
      includeFiveFlag = true;
    }

    // 3. Построим finalSelectedDigits
    //    - Разрешаем только 1..9 в принципе
    //    - Если includeFiveFlag=false => оставляем только 1..4
    let selectedDigits = rawDigits
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 9);

    if (!includeFiveFlag) {
      // методический режим "без верхней бусины вообще",
      // значит никакие 5,6,7,8,9 недоступны как единый жест
      selectedDigits = selectedDigits.filter(n => n <= 4);
    }

    // подстраховка: чтобы не было пустого списка
    if (selectedDigits.length === 0) {
      // если вдруг пользователь выбрал только 7,
      // мы бы уже сделали includeFiveFlag=true выше, так что сюда
      // реально попасть можно только если пользователь сломал UI.
      // fallback: пусть будет хотя бы "1"
      selectedDigits = [1];
    }

    this.name = "Просто";
    this.description =
      "Одноразрядные жесты. За один шаг можно одновременно трогать верхнюю и нижние бусины.";

    this.config = {
      // Физика стойки
      minState: 0,
      maxState: 9,

      // длина цепочки
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // что разрешено как МОДУЛЬ шага (например [7] -> +7/-7)
      selectedDigits,

      // фактическое разрешение работы с верхней бусиной
      includeFive: includeFiveFlag,
      hasFive: includeFiveFlag,

      // методика
      firstActionMustBePositive: true,

      // разрядность
      digitCount: config.digitCount ?? 1,

      // совместимость с остальным кодом
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule init:
  selectedDigits(afterFilter)=[${this.config.selectedDigits.join(", ")}]
  includeFive=${this.config.includeFive}
  digitCount=${this.config.digitCount}
  minSteps=${this.config.minSteps}
  maxSteps=${this.config.maxSteps}
  onlyAddition=${this.config.onlyAddition}
  onlySubtraction=${this.config.onlySubtraction}
  firstActionMustBePositive=${this.config.firstActionMustBePositive}`
    );
  }

  // Кол-во шагов
  generateStepsCount() {
    const min = this.config.minSteps ?? 2;
    const max = this.config.maxSteps ?? min;
    if (min === max) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // Начальное состояние (всегда нули)
  generateStartState() {
    const dc = this.config.digitCount ?? 1;
    if (dc === 1) return 0;
    return Array(dc).fill(0);
  }

  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    return action >= 0 ? `+${action}` : `${action}`;
  }

  getDigitValue(currentState, position = 0) {
    if (Array.isArray(currentState)) {
      return currentState[position] ?? 0;
    }
    return currentState ?? 0;
  }

  applyAction(currentState, action) {
    if (typeof action === "object" && action !== null) {
      const arr = Array.isArray(currentState)
        ? [...currentState]
        : [currentState];
      const { position, value } = action;
      arr[position] = (arr[position] ?? 0) + value;
      return arr;
    } else {
      const v = this.getDigitValue(currentState, 0);
      return v + action;
    }
  }

  stateToNumber(state) {
    if (Array.isArray(state)) {
      return state.reduce(
        (sum, digit, index) => sum + digit * Math.pow(10, index),
        0
      );
    }
    return state ?? 0;
  }

  isValidState(state) {
    const { minState, maxState } = this.config;
    if (Array.isArray(state)) {
      return state.every(v => v >= minState && v <= maxState);
    }
    return state >= minState && state <= maxState;
  }

  /**
   * Можно ли за один жест перейти от v к v2?
   *
   * Мы разрешаем одновременно:
   *  - менять верхнюю бусину (5) вкл/выкл
   *  - и менять количество нижних бусин (0..4)
   *
   * Ограничения:
   *  - итоговое состояние v2 должно быть 0..9
   *  - если includeFive=false, верхняя бусина не может меняться
   *    (нельзя скакнуть через 5)
   */
  canDoInOneGesture(v, v2) {
    if (v2 < 0 || v2 > 9) return false;

    const u1 = v >= 5;
    const u2 = v2 >= 5;

    if (!this.config.includeFive) {
      // верхняя бусина вообще "запрещена"
      // значит мы не имеем права менять факт включена/выключена
      if (u1 !== u2) {
        return false;
      }
    }

    // нижние бусины (v % 5) могут измениться на любое другое число 0..4,
    // это мы допускаем внутри одного жеста.
    return true;
  }

  /**
   * Основная функция: какие шаги допустимы из текущего состояния?
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      selectedDigits,
      onlyAddition,
      onlySubtraction,
      digitCount
    } = this.config;

    const v = this.getDigitValue(currentState, position);
    const deltas = new Set();

    for (const d of selectedDigits) {
      // пробуем +d
      if (!onlySubtraction) {
        const v2 = v + d;
        if (v2 >= 0 && v2 <= 9 && this.canDoInOneGesture(v, v2)) {
          deltas.add(+d);
        }
      }

      // пробуем -d (кроме первого шага, минус нельзя начинать)
      if (!onlyAddition && !isFirstAction) {
        const v2 = v - d;
        if (v2 >= 0 && v2 <= 9 && this.canDoInOneGesture(v, v2)) {
          deltas.add(-d);
        }
      }
    }

    const resultDeltas = Array.from(deltas);

    if (digitCount > 1) {
      // многоразрядный будет обёрнут в {position,value}
      return resultDeltas.map(value => ({ position, value }));
    }

    // лог для отладки
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;
    console.log(
      `⚙️ getAvailableActions(simple): state=${stateStr}, v=${v} → [${resultDeltas.join(
        ", "
      )}]`
    );

    return resultDeltas;
  }

  /**
   * Проверка сгенерированного примера.
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { digitCount, selectedDigits, minState, maxState } = this.config;

    // старт должен быть 0 (или [0,...])
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Стартовое состояние ${startNum} ≠ 0`);
      return false;
    }

    // первый шаг должен быть положительным
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

    // все промежуточные состояния должны быть валидными
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const s = Array.isArray(step.toState)
          ? `[${step.toState.join(", ")}]`
          : step.toState;
        console.error(
          `❌ Недопустимое состояние ${s} вне диапазона ${minState}..${maxState}`
        );
        return false;
      }
    }

    // пересчёт конца
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

    // валидность финала
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
