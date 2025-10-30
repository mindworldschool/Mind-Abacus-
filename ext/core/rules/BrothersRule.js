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

  /**
   * Создание таблицы обменных пар
   * Брат n: обмен n нижних бусин на верхнюю (или наоборот)
   * - +delta где delta=5-n: когда есть n нижних для обмена
   * - -delta: когда есть верхняя для обмена
   */
  _buildBrotherPairs(digits) {
    const pairs = new Set();

    for (const n of digits) {
      const delta = 5 - n; // результат обмена

      switch (n) {
        case 4: // Брат 4: обмен 4↔5, дает delta=±1
          // +1: из состояний с L=4 (можем убрать 4 нижние)
          pairs.add(`4-5-brother4`);   // 4 нижние → верхняя
          pairs.add(`9-10-brother4`);  // U+4L, но 10 вне диапазона, не добавится
          // -1: из состояний с верхней (можем убрать верхнюю)
          for (let s = 5; s <= 9; s++) {
            pairs.add(`${s}-${s-1}-brother4`);
          }
          break;

        case 3: // Брат 3: обмен 3↔8, дает delta=±2
          // +2: из состояний с L≥3
          pairs.add(`3-5-brother3`);
          pairs.add(`4-6-brother3`);
          pairs.add(`8-10-brother3`); // вне диапазона
          pairs.add(`9-11-brother3`); // вне диапазона
          // -2: из состояний с верхней
          for (let s = 5; s <= 9; s++) {
            if (s - 2 >= 0) pairs.add(`${s}-${s-2}-brother3`);
          }
          break;

        case 2: // Брат 2: обмен 2↔7, дает delta=±3
          // +3: из состояний с L≥2
          pairs.add(`2-5-brother2`);
          pairs.add(`3-6-brother2`);
          pairs.add(`4-7-brother2`);
          pairs.add(`7-10-brother2`); // вне диапазона
          pairs.add(`8-11-brother2`); // вне диапазона
          pairs.add(`9-12-brother2`); // вне диапазона
          // -3: из состояний с верхней
          for (let s = 5; s <= 9; s++) {
            if (s - 3 >= 0) pairs.add(`${s}-${s-3}-brother2`);
          }
          break;

        case 1: // Брат 1: обмен 1↔6, дает delta=±4
          // +4: из состояний с L≥1
          pairs.add(`1-5-brother1`);
          pairs.add(`2-6-brother1`);
          pairs.add(`3-7-brother1`);
          pairs.add(`4-8-brother1`);
          pairs.add(`6-10-brother1`); // вне диапазона
          pairs.add(`7-11-brother1`); // вне диапазона
          pairs.add(`8-12-brother1`); // вне диапазона
          pairs.add(`9-13-brother1`); // вне диапазона
          // -4: из состояний с верхней
          for (let s = 5; s <= 9; s++) {
            if (s - 4 >= 0) pairs.add(`${s}-${s-4}-brother1`);
          }
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
        // Это БРАТСКИЙ шаг
        const formula = this._buildBrotherFormula(v, v2, brotherN, direction);
        if (formula) {
          actions.push({
            value: delta,
            isBrother: true,
            brotherN,
            formula
          });
        }
      } else {
        // Обычный "простой" шаг (без обмена через 5)
        if (this.isSimpleTransition(v, v2, direction)) {
          actions.push({ value: delta, isBrother: false });
        }
      }
    }

    console.log(`👬 getAvailableActions(v=${v}): нашли ${actions.length} действий`);
    return actions;
  }

  /**
   * Строит формулу для братского шага
   * Например, для +1 через брата 4: [-4, +5]
   *
   * Брат n: обмениваем n нижних бусин на верхнюю
   * - +delta где delta=5-n: убираем n нижних, ставим верхнюю (-n+5)
   * - -delta где delta=5-n: убираем верхнюю, ставим n нижних (-5+n)
   *
   * Упрощенная проверка: просто проверяем математику, не детальную физику бусин
   */
  _buildBrotherFormula(v, v2, n, dir) {
    // n - это количество нижних бусин в обмене (1,2,3,4)
    // delta - результат обмена (5-n)
    const delta = 5 - n;

    if (dir === "up") {
      // +delta = -n +5 (убрать n нижних, поставить верхнюю)
      // Проверка: есть ли n нижних бусин для убирания
      const L = this._L(v);
      if (L < n) return null; // не хватает нижних

      // Проверка: можем ли поставить верхнюю после убирания n нижних
      const vMid = v - n;
      if (vMid < 0 || vMid > 9) return null;
      if (vMid >= 5) return null; // уже есть верхняя

      // Финальная проверка результата
      if (v2 < 0 || v2 > 9) return null;

      return [
        { op: "-", val: n, source: "lower" },
        { op: "+", val: 5, source: "upper" }
      ];
    } else {
      // -delta = -5 +n (убрать верхнюю, поставить n нижних)
      // Проверка: есть ли верхняя бусина
      if (v < 5) return null; // нет верхней

      // Проверка: результат после операций
      const vMid = v - 5;
      const vFinal = vMid + n;
      if (vFinal < 0 || vFinal > 9) return null;

      return [
        { op: "-", val: 5, source: "upper" },
        { op: "+", val: n, source: "lower" }
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
