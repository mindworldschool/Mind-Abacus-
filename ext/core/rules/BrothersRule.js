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

    // 🔥 НОВОЕ: Берем цифры из блока "Просто" для обычных шагов
    console.log("🔍 RAW config.blocks?.simple?.digits:", config.blocks?.simple?.digits);
    
    const simpleBlockDigits = Array.isArray(config.blocks?.simple?.digits)
      ? config.blocks.simple.digits
          .map(n => {
            const parsed = typeof n === 'string' ? parseInt(n, 10) : n;
            return Number.isFinite(parsed) ? parsed : null;
          })
          .filter(n => n !== null && n >= 1 && n <= 9)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9]; // дефолт - все цифры

    console.log("👬 BrothersRule: маппинг братьев UI→internal:", 
      brothersDigitsFromUI.map((ui, i) => `UI=${ui} → n=${brothersDigits[i]} → Δ=${ui}`).join(", ")
    );
    console.log("📘 BrothersRule: цифры из блока Просто:", simpleBlockDigits);

    // 🔥 ДИНАМИЧЕСКИЙ процент братских действий:
    // Короткие примеры (2-4 шага): 30% братских
    // Средние примеры (5-7 шагов): 40-50% братских
    // Длинные примеры (8+ шагов): 50-70% братских
    const maxSteps = config.maxSteps ?? 8;
    const basePriority = 0.3; // минимум 30%
    const scaleFactor = Math.min(0.4, maxSteps / 20); // до +40%
    const brotherPriority = basePriority + scaleFactor;
    
    this.config = {
      ...this.config,
      name: "Братья",
      minState: 0,
      maxState: 9,
      // 🔥 УБРАНЫ захардкоженные лимиты - используем из config!
      minSteps: config.minSteps ?? 2,
      maxSteps: maxSteps,
      brothersDigits,                    // internal [4,3,2,1] для UI [1,2,3,4]
      brothersDigitsUI: brothersDigitsFromUI,  // сохраняем UI версию для логов
      simpleBlockDigits,                  // 🔥 НОВОЕ: цифры из блока "Просто"
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,
      brotherPriority: brotherPriority,  // 🔥 ДИНАМИЧЕСКИЙ процент
      blocks: config.blocks ?? {}
    };

    console.log(
      `👬 BrothersRule init: братья UI=[${brothersDigitsFromUI.join(", ")}],` +
      ` internal=[${brothersDigits.join(", ")}],` +
      ` простые цифры=[${simpleBlockDigits.join(", ")}],` +
      ` minSteps=${this.config.minSteps}, maxSteps=${this.config.maxSteps},` +
      ` brotherPriority=${(brotherPriority * 100).toFixed(0)}%,` +
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
   * 
   * ЛОГИКА "Только сложение/вычитание":
   * - Применяется ТОЛЬКО к братским шагам (выбранной тренируемой цифре)
   * - Простые вспомогательные шаги ВСЕГДА доступны с любым знаком
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const { onlyAddition, onlySubtraction, brothersDigits, simpleBlockDigits } = this.config;
    const v = currentState;
    const brotherActions = [];
    const simpleActions = [];

    // === БРАТСКИЕ ШАГИ (с ограничением знака) ===
    for (let v2 = 0; v2 <= 9; v2++) {
      if (v2 === v) continue;
      const delta = v2 - v;
      const dir = delta > 0 ? "up" : "down";

      // 🔥 ОГРАНИЧЕНИЯ ПРИМЕНЯЮТСЯ ТОЛЬКО К БРАТСКИМ ШАГАМ!
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
            label: `через 5 (брат ${5-brotherN})`,
            value: delta,
            isBrother: true,
            brotherN: 5 - brotherN,
            formula
          });
        }
      }
    }

    // === ПРОСТЫЕ ШАГИ (БЕЗ ограничений знака - вспомогательные!) ===
    const L = this._L(v);
    const U = this._U(v);

    // ✅ СЛОЖЕНИЕ: всегда доступно (не зависит от onlyAddition/onlySubtraction)
    for (const digit of simpleBlockDigits) {
      if (isFirstAction && digit <= 0) continue; // первый шаг всегда положительный
      
      // Цифры 1-4: проверяем нижние бусины
      if (digit >= 1 && digit <= 4) {
        if (this._canPlusLower(v, digit)) {
          simpleActions.push(digit);
        }
      }
      // Цифра 5: проверяем верхнюю бусину
      else if (digit === 5) {
        if (U === 0 && v <= 4) {
          simpleActions.push(5);
        }
      }
      // Цифры 6-9: проверяем комбинацию верхней + нижних
      else if (digit >= 6 && digit <= 9) {
        const lower = digit - 5;
        if (U === 0 && this._canPlusLower(v, lower) && v + digit <= 9) {
          simpleActions.push(digit);
        }
      }
    }

    // ✅ ВЫЧИТАНИЕ: всегда доступно (не зависит от onlyAddition/onlySubtraction)
    if (!isFirstAction) {
      for (const digit of simpleBlockDigits) {
        // Цифры 1-4: проверяем нижние бусины
        if (digit >= 1 && digit <= 4) {
          if (this._canMinusLower(v, digit)) {
            simpleActions.push(-digit);
          }
        }
        // Цифра 5: проверяем верхнюю бусину
        else if (digit === 5) {
          if (U === 1 && v >= 5) {
            simpleActions.push(-5);
          }
        }
        // Цифры 6-9: проверяем комбинацию верхней + нижних
        else if (digit >= 6 && digit <= 9) {
          const lower = digit - 5;
          if (U === 1 && this._canMinusLower(v, lower) && v - digit >= 0) {
            simpleActions.push(-digit);
          }
        }
      }
    }

    // 🔥 ПРИОРИТИЗАЦИЯ: динамический процент
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
