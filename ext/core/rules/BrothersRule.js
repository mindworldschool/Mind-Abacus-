// ext/core/rules/BrothersRule.js - Правило "Братья" (ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ v2)
// 
// ИСПРАВЛЕНИЯ:
// 1. ✅ Убран get name(), добавлен this.name
// 2. ✅ Приоритизация братских шагов (50% вместо 80% - меньше повторов)
// 3. ✅ ПРАВИЛЬНЫЙ маппинг братьев: UI "брат N" → переход ±N
// 4. ✅ Убраны захардкоженные лимиты minSteps/maxSteps
// 5. ✅ Формулы без source

import { BaseRule } from "./BaseRule.js";

export class BrothersRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // 🔥 Устанавливаем имя напрямую
    this.name = "Братья";

    // Какие "братья" тренируем из UI: [1,2,3,4]
    // НО! В UI "брат N" означает "переход ±N"
    // А в коде n → delta = 5-n
    // Поэтому инвертируем: UI_N → internal_n = 5-UI_N
    const brothersDigitsFromUI = Array.isArray(config.selectedDigits)
      ? config.selectedDigits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4)
      : [4];

    // 🔥 ИНВЕРСИЯ: UI "брат 4" → internal n=1 → delta=4
    const brothersDigits = brothersDigitsFromUI.map(ui_n => 5 - ui_n);

    console.log("👬 BrothersRule: маппинг братьев UI→internal:", 
      brothersDigitsFromUI.map((ui, i) => `UI=${ui} → n=${brothersDigits[i]} → Δ=${ui}`).join(", ")
    );

    this.config = {
      ...this.config,
      name: "Братья",
      minState: 0,
      maxState: 9,
      // 🔥 УБРАНЫ захардкоженные лимиты - используем из config!
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 8,
      brothersDigits,                    // internal [4,3,2,1] для UI [1,2,3,4]
      brothersDigitsUI: brothersDigitsFromUI,  // сохраняем UI версию для логов
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,
      brotherPriority: 0.5,  // 🔥 50% вместо 80% - меньше повторов
      blocks: config.blocks ?? {}
    };

    console.log(
      `👬 BrothersRule init: братья UI=[${brothersDigitsFromUI.join(", ")}],` +
      ` internal=[${brothersDigits.join(", ")}],` +
      ` minSteps=${this.config.minSteps}, maxSteps=${this.config.maxSteps},` +
      ` onlyAdd=${this.config.onlyAddition}, onlySub=${this.config.onlySubtraction}`
    );

    // Построим карту братских переходов
    this.brotherPairs = this._buildBrotherPairs(brothersDigits);

    // Выводим таблицу братских переходов
    console.log("📊 Таблица братских переходов:");
    const transitions = {};
    for (const pairKey of this.brotherPairs) {
      const [from, to, brotherInfo] = pairKey.split('-');
      if (!transitions[from]) transitions[from] = [];
      transitions[from].push(`${to} (${brotherInfo})`);
    }
    for (const [from, toList] of Object.entries(transitions).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
      console.log(`  Из ${from} → [${toList.join(', ')}]`);
    }
  }

  // ===== Помощники по физике одной стойки S∈[0..9] =====
  _U(S) { return S >= 5 ? 1 : 0; }
  _L(S) { return S >= 5 ? S - 5 : S; }

  _canMinusLower(S, v) {
    if (v < 1 || v > 4) return false;
    const L = this._L(S);
    return L >= v && (S - v) >= 0;
  }
  
  _canPlusLower(S, v) {
    if (v < 1 || v > 4) return false;
    const L = this._L(S);
    return L + v <= 4 && (S + v) <= 9;
  }
  
  _canPlusUpper(S) {
    return S <= 4;
  }
  
  _canMinusUpper(S) {
    return S >= 5;
  }
  
  _canPlusLowerAfter(S, v) {
    if (v < 1 || v > 4) return false;
    const L = this._L(S);
    return this._U(S) === 0 && (L + v) <= 4 && (S + v) <= 9;
  }

  /**
   * Программно строим все пары v->v2, которые реализуемы БРАТСКИМ обменом
   * @param {number[]} digits - internal n (не UI версия!)
   */
  _buildBrotherPairs(digits) {
    const set = new Set();

    for (let v = 0; v <= 9; v++) {
      for (const n of digits) {
        const delta = 5 - n;

        // Вверх (+delta)
        if (this._U(v) === 0 && this._canMinusLower(v, n) && this._canPlusUpper(v - n)) {
          const v2 = v - n + 5;
          if (v2 >= 0 && v2 <= 9) {
            set.add(`${v}-${v2}-brother${n}`);
          }
        }

        // Вниз (-delta)
        if (this._U(v) === 1 && this._canMinusUpper(v)) {
          const vMid = v - 5;
          if (this._canPlusLowerAfter(vMid, n)) {
            const v2 = vMid + n;
            if (v2 >= 0 && v2 <= 9) {
              set.add(`${v}-${v2}-brother${n}`);
            }
          }
        }
      }
    }
    return set;
  }

  generateStartState() {
    return 0;
  }

  generateStepsCount() {
    const { minSteps, maxSteps } = this.config;
    const steps = minSteps + Math.floor(Math.random() * (maxSteps - minSteps + 1));
    console.log(`📏 BrothersRule.generateStepsCount: ${steps} (диапазон ${minSteps}-${maxSteps})`);
    return steps;
  }

  isValidState(v) {
    return v >= this.config.minState && v <= this.config.maxState;
  }

  /**
   * Возвращаем И братские, И простые шаги
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const { onlyAddition, onlySubtraction, brothersDigits } = this.config;
    const v = currentState;
    const brotherActions = [];
    const simpleActions = [];

    // === БРАТСКИЕ ШАГИ ===
    for (let v2 = 0; v2 <= 9; v2++) {
      if (v2 === v) continue;
      const delta = v2 - v;
      const dir = delta > 0 ? "up" : "down";

      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;
      if (isFirstAction && delta < 0) continue;

      let brotherN = null;
      for (const n of brothersDigits) {
        if (this.brotherPairs.has(`${v}-${v2}-brother${n}`)) {
          brotherN = n;
          break;
        }
      }

      if (brotherN != null) {
        const formula = this._buildBrotherFormula(v, v2, brotherN, dir);
        if (formula) {
          brotherActions.push({
            label: `через 5 (брат ${5-brotherN})`, // показываем UI версию!
            value: delta,
            isBrother: true,
            brotherN: 5 - brotherN,  // 🔥 сохраняем UI версию для логов
            formula
          });
        }
      }
    }

    // === ПРОСТЫЕ ШАГИ ===
    const L = this._L(v);
    const U = this._U(v);

    if (!onlySubtraction) {
      for (let n = 1; n <= 4; n++) {
        if (!isFirstAction || n > 0) {
          if (this._canPlusLower(v, n)) {
            simpleActions.push(n);
          }
        }
      }
      if (U === 0 && v <= 4) {
        simpleActions.push(5);
      }
    }

    if (!onlyAddition && !isFirstAction) {
      for (let n = 1; n <= 4; n++) {
        if (this._canMinusLower(v, n)) {
          simpleActions.push(-n);
        }
      }
      if (U === 1 && v >= 5) {
        simpleActions.push(-5);
      }
    }

    // 🔥 ПРИОРИТИЗАЦИЯ: 50% вместо 80%
    if (brotherActions.length > 0 && Math.random() < this.config.brotherPriority) {
      console.log(`👬 Приоритет братским шагам из ${v} (доступно ${brotherActions.length})`);
      return brotherActions;
    }

    const allActions = [...brotherActions, ...simpleActions];
    console.log(`🎲 Состояние ${v}: братских=${brotherActions.length}, простых=${simpleActions.length}, всего=${allActions.length}`);
    return allActions;
  }

  /**
   * Разложение братского шага в физические действия
   */
  _buildBrotherFormula(v, v2, n, dir) {
    if (dir === "up") {
      return [
        { op: "+", val: 5 },
        { op: "-", val: n }
      ];
    } else {
      return [
        { op: "-", val: 5 },
        { op: "+", val: n }
      ];
    }
  }

  applyAction(currentState, action) {
    const delta = typeof action === "object" ? action.value : action;
    return currentState + delta;
  }

  formatAction(action) {
    const val = typeof action === "object" ? action.value : action;
    return val >= 0 ? `+${val}` : `${val}`;
  }

  stateToNumber(state) {
    return typeof state === 'number' ? state : 0;
  }

  /**
   * Валидация: хотя бы 1 братский шаг
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { minState, maxState } = this.config;

    if (!steps || steps.length < 1) {
      console.warn("❌ validateExample: нет шагов");
      return false;
    }

    let s = start;
    let hasBrother = false;

    for (const step of steps) {
      const act = step.action ?? step;
      s = this.applyAction(s, act);
      if (s < minState || s > maxState) {
        console.warn(`❌ validateExample: выход за диапазон [${minState}, ${maxState}]: ${s}`);
        return false;
      }
      if (typeof act === "object" && act.isBrother) hasBrother = true;
    }

    if (s !== answer) {
      console.warn(`❌ validateExample: ответ не совпадает: ${s} !== ${answer}`);
      return false;
    }

    if (!hasBrother) {
      console.warn("❌ validateExample: нет братских шагов");
      return false;
    }

    console.log(`✅ validateExample: пример валидный (${steps.length} шагов, есть братские)`);
    return true;
  }
}
