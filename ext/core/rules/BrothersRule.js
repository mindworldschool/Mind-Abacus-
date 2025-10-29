// ext/core/rules/BrothersRule.js
//
// Правило "Братья" 👬
// Логика переходов через 5 (обмен верхней и нижних бусин)
// Используется, если активен блок "Братья" в настройках тренажёра.

import { BaseRule } from "./BaseRule.js";

export class BrothersRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    const brothersDigits = Array.isArray(config.selectedDigits)
      ? config.selectedDigits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4)
      : [4]; // по умолчанию тренируем 4↔5

    this.config = {
      name: "Братья",
      minState: 0,
      maxState: 9,
      minSteps: config.minSteps ?? 3,
      maxSteps: config.maxSteps ?? 7,
      brothersDigits,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,
      blocks: config.blocks ?? {},
      ...config
    };

    console.log(
      `👬 BrothersRule инициализировано: братья=${brothersDigits.join(
        ", "
      )}, onlyAddition=${this.config.onlyAddition}, onlySubtraction=${this.config.onlySubtraction}`
    );

    // Таблица разрешённых обменных пар (в одну и другую сторону)
    // Каждому брату соответствует пара/пары состояний
    this.exchangePairs = this._buildExchangePairs(brothersDigits);
  }

  /** Создание таблицы обменов на основе выбранных братьев */
  _buildExchangePairs(digits) {
    const pairs = new Set();

    for (const d of digits) {
      switch (d) {
        case 4:
          // классический обмен 4 <-> 5
          pairs.add("4-5");
          pairs.add("5-4");
          break;
        case 3:
          // 3 <-> 8
          pairs.add("3-8");
          pairs.add("8-3");
          break;
        case 2:
          // 2 <-> 7
          pairs.add("2-7");
          pairs.add("7-2");
          break;
        case 1:
          // 1 <-> 6 и 0 <-> 5
          pairs.add("1-6");
          pairs.add("6-1");
          pairs.add("0-5");
          pairs.add("5-0");
          break;
        default:
          break;
      }
    }

    return pairs;
  }

  /** Начальное состояние */
  generateStartState() {
    return 0;
  }

  /** Случайная длина цепочки */
  generateStepsCount() {
    const min = this.config.minSteps;
    const max = this.config.maxSteps;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /** Проверка валидности состояния */
  isValidState(v) {
    return v >= this.config.minState && v <= this.config.maxState;
  }

  /** Получение возможных действий из текущего состояния */
  getAvailableActions(currentState, isFirstAction = false) {
    const { onlyAddition, onlySubtraction } = this.config;
    const v = currentState;
    const actions = [];

    // Возможные будущие состояния (0..9)
    for (let v2 = 0; v2 <= 9; v2++) {
      if (v2 === v) continue;

      const delta = v2 - v;
      const direction = delta > 0 ? "up" : "down";

      // Ограничение по флагам
      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;
      if (isFirstAction && delta < 0) continue;

      // Проверяем, является ли переход разрешённым "братским" или физически возможным (обычный)
      if (this.isBrotherGestureTransition(v, v2, direction) || this.isSimpleTransition(v, v2, direction)) {
        actions.push(delta);
      }
    }

    console.log(`👬 getAvailableActions(v=${v}) → [${actions.join(", ")}]`);
    return actions;
  }

  /** Простая физика (как в блоке "Просто"): без обмена */
  isSimpleTransition(v, v2, dir) {
    if (v2 < 0 || v2 > 9) return false;
    if (dir === "up" && v2 <= v) return false;
    if (dir === "down" && v2 >= v) return false;

    const wasTop = v >= 5;
    const wasBot = wasTop ? v - 5 : v;
    const isTop = v2 >= 5;
    const isBot = isTop ? v2 - 5 : v2;

    const topChange = (isTop ? 1 : 0) - (wasTop ? 1 : 0);
    const botChange = isBot - wasBot;

    if (dir === "up") {
      if (topChange < 0 || botChange < 0) return false;
      if (topChange === 0 && botChange === 0) return false;
      return true;
    }
    if (dir === "down") {
      if (topChange > 0 || botChange > 0) return false;
      if (topChange === 0 && botChange === 0) return false;
      return true;
    }
    return false;
  }

  /** Проверка, является ли шаг "братским" обменом */
  isBrotherGestureTransition(v, v2, dir) {
    if (v2 < 0 || v2 > 9) return false;

    const key = `${v}-${v2}`;
    if (this.exchangePairs.has(key)) {
      // Например 4→5 или 5→4, 2→7 и т.д.
      return true;
    }

    // Дополнительно можно разрешить расширенные комбинации вроде (v,v2) с обменом верхней и нижних
    // но в этой версии достаточно таблицы.
    return false;
  }

  /** Применить шаг */
  applyAction(currentState, delta) {
    return currentState + delta;
  }

  /** Формат отображения шага */
  formatAction(a) {
    return a >= 0 ? `+${a}` : `${a}`;
  }

  /** Проверка корректности примера */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { minState, maxState } = this.config;
    let state = start;

    for (const step of steps) {
      const next = this.applyAction(state, step.action);
      if (next < minState || next > maxState) {
        console.error(`❌ Состояние ${next} вне диапазона`);
        return false;
      }
      state = next;
    }

    return state === answer;
  }
}
