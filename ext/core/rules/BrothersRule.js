// ext/core/rules/BrothersRule.js (УЛУЧШЕННАЯ ВЕРСИЯ)
//
// Правило "Братья" 👬
// Логика переходов через 5 (обмен верхней и нижних бусин)
// Каждый пример ОБЯЗАН содержать хотя бы один "братский" переход

import { BaseRule } from "./BaseRule.js";

export class BrothersRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // Какие пары "братьев" тренируем (1,2,3,4)
    const brothersDigits = Array.isArray(config.selectedDigits)
      ? config.selectedDigits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4)
      : [4]; // по умолчанию только 4↔5

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
      `👬 BrothersRule: братья=[${brothersDigits.join(", ")}], ` +
      `onlyAdd=${this.config.onlyAddition}, onlySub=${this.config.onlySubtraction}`
    );

    // Таблица "братских" пар для быстрой проверки
    this.brotherPairs = this._buildBrotherPairs(brothersDigits);
  }

  /** Создание таблицы обменных пар */
  _buildBrotherPairs(digits) {
    const pairs = new Set();
    
    for (const d of digits) {
      switch (d) {
        case 4: // 4↔5: переходы 4→5, 5→4, 0→5, 5→0, 1→6, 6→1, ...
          for (let s = 0; s <= 9; s++) {
            // +1 через (+5−4): 0→1, 1→2, 2→3, 3→4
            if (s <= 3) pairs.add(`${s}-${s+1}-brother4`);
            // −1 через (−5+4): 9→8, 8→7, 7→6, 6→5, 5→4
            if (s >= 5) pairs.add(`${s}-${s-1}-brother4`);
          }
          break;
        case 3: // 3↔8
          // +2 через (+5−3): 0→2, 1→3, 2→4
          for (let s = 0; s <= 2; s++) pairs.add(`${s}-${s+2}-brother3`);
          // −2 через (−5+3): 9→7, 8→6, 7→5
          for (let s = 7; s <= 9; s++) pairs.add(`${s}-${s-2}-brother3`);
          break;
        case 2: // 2↔7
          // +3 через (+5−2): 0→3, 1→4
          for (let s = 0; s <= 1; s++) pairs.add(`${s}-${s+3}-brother2`);
          // −3 через (−5+2): 9→6, 8→5
          for (let s = 8; s <= 9; s++) pairs.add(`${s}-${s-3}-brother2`);
          break;
        case 1: // 1↔6
          // +4 через (+5−1): 0→4
          pairs.add(`0-4-brother1`);
          // −4 через (−5+1): 9→5
          pairs.add(`9-5-brother1`);
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

  /** 
   * КЛЮЧЕВОЙ МЕТОД: возвращает ВСЕ возможные действия из currentState
   * Каждое действие = объект { value: number, isBrother: boolean, formula?: [...] }
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const { onlyAddition, onlySubtraction } = this.config;
    const v = currentState;
    const actions = [];

    // Перебираем все возможные целевые состояния (0..9)
    for (let v2 = 0; v2 <= 9; v2++) {
      if (v2 === v) continue; // не стоим на месте

      const delta = v2 - v;
      const direction = delta > 0 ? "up" : "down";

      // Фильтруем по режиму (только + / только −)
      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;
      if (isFirstAction && delta < 0) continue; // первый шаг не может быть минусом

      // Проверяем, является ли переход "братским"
      const brotherKey = `${v}-${v2}-brother`;
      let isBrotherTransition = false;
      let brotherN = null;

      for (const n of this.config.brothersDigits) {
        if (this.brotherPairs.has(`${v}-${v2}-brother${n}`)) {
          isBrotherTransition = true;
          brotherN = n;
          break;
        }
      }

      if (isBrotherTransition) {
        // Это БРАТСКИЙ шаг - ТОЛЬКО такие шаги разрешены в блоке "Братья"
        const formula = this._buildBrotherFormula(v, v2, brotherN, direction);
        if (formula) {
          actions.push({
            value: delta,
            isBrother: true,
            brotherN,
            formula
          });
        }
      }
      // ❌ В блоке "Братья" НЕТ обычных простых шагов!
      // Должны быть ТОЛЬКО переходы через 5 (обмен верхней и нижних бусин)
    }

    console.log(`👬 getAvailableActions(v=${v}): нашли ${actions.length} действий`);
    return actions;
  }

  /**
   * Строит формулу для братского шага
   * Например, для +1 через брата 4: [+5, −4]
   */
  _buildBrotherFormula(v, v2, n, dir) {
    const brother = 5 - n; // комплементарное число
    
    if (dir === "up") {
      // +n = +5 − brother
      // Проверяем физику
      if (!this._canPlus5(v)) return null;
      const vMid = v + 5;
      if (!this._canMinusLower(vMid, brother)) return null;
      
      return [
        { op: "+", val: 5, source: "upper" },
        { op: "-", val: brother, source: "lower" }
      ];
    } else {
      // −n = −5 + brother
      if (!this._canMinus5(v)) return null;
      const vMid = v - 5;
      if (!this._canPlusLower(vMid, brother)) return null;
      
      return [
        { op: "-", val: 5, source: "upper" },
        { op: "+", val: brother, source: "lower" }
      ];
    }
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

  /** Применить действие к состоянию */
  applyAction(currentState, action) {
    // action может быть: число, или объект {value, isBrother, formula}
    const delta = typeof action === "object" ? action.value : action;
    return currentState + delta;
  }

  /** Формат отображения шага */
  formatAction(action) {
    const val = typeof action === "object" ? action.value : action;
    return val >= 0 ? `+${val}` : `${val}`;
  }

  /** Проверка валидности примера */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { minState, maxState } = this.config;
    let state = start;

    // 1. Проверяем каждый шаг
    for (const step of steps) {
      const next = this.applyAction(state, step.action);
      if (next < minState || next > maxState) {
        console.error(`❌ Состояние ${next} вне диапазона [${minState}..${maxState}]`);
        return false;
      }
      state = next;
    }

    // 2. Проверяем финальное состояние
    if (state !== answer) {
      console.error(`❌ Финал ${state} ≠ answer ${answer}`);
      return false;
    }

    // 3. ОБЯЗАТЕЛЬНО: хотя бы один шаг должен быть "братским"
    const hasBrother = steps.some(step => 
      typeof step.action === "object" && step.action.isBrother
    );
    
    if (!hasBrother) {
      console.error(`❌ Пример не содержит братских шагов!`);
      return false;
    }

    return true;
  }

  // ===== Физика соробана (одна стойка 0..9) =====

  _U(S) { return S >= 5 ? 1 : 0; }  // верхняя бусина
  _L(S) { return S >= 5 ? S - 5 : S; }  // нижние бусины

  _canPlus5(S) {
    return (S <= 4) && (S + 5 <= 9);
  }

  _canMinus5(S) {
    return (S >= 5) && (S - 5 >= 0);
  }

  _canPlusLower(S, v) {
    if (v < 1 || v > 4) return false;
    const L = this._L(S);
    const U = this._U(S);
    return (S + v <= 9) && ((U === 0 && L + v <= 4) || (U === 1 && (S + v) <= 9));
  }

  _canMinusLower(S, v) {
    if (v < 1 || v > 4) return false;
    const L = this._L(S);
    return (S - v >= 0) && (L >= v);
  }
}
