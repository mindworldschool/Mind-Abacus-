// ext/core/rules/BrothersRule.js (ПЕРЕРАБОТАНО)
// Правило "Братья" 👬 — гарантирует шаги через 5 с физически корректной проверкой.
// Ключевые отличия от предыдущей версии:
// 1) Таблица переходов строится ПРОГРАММНО для всех S∈[0..9] и n∈selectedDigits,
//    а не через частично забитые вручную пары — это исключает пропуски/ошибки.
// 2) Каждый братский шаг содержит формулу операций на соробане (массив из двух
//    под-операций), чтобы UI мог отображать именно обмен через 5.
// 3) Пример обязан содержать ≥1 братский шаг (validateExample).

import { BaseRule } from "./BaseRule.js";

export class BrothersRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // Какие "братья" тренируем: из {1,2,3,4}
    const brothersDigits = Array.isArray(config.selectedDigits)
      ? config.selectedDigits.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4)
      : [4];

    this.config = {
      preferBrothersOnly: (config.preferBrothersOnly ?? true),
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
      `👬 BrothersRule init: братья=[${brothersDigits.join(", ")}],` +
      ` onlyAdd=${this.config.onlyAddition}, onlySub=${this.config.onlySubtraction}`
    );

    // Построим карту допустимых братских переходов заранее
    this.brotherPairs = this._buildBrotherPairs(brothersDigits);

    // Выводим таблицу братских переходов для отладки
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
  _U(S) { return S >= 5 ? 1 : 0; }         // верхняя активна?
  _L(S) { return S >= 5 ? S - 5 : S; }      // количество нижних бусин

  _canMinusLower(S, v) {
    if (v < 1 || v > 4) return false;
    const L = this._L(S);
    return L >= v && (S - v) >= 0;
  }
  _canPlusUpper(S) {
    // можно опустить верхнюю, только если сейчас верхняя не активна
    return S <= 4;
  }
  _canMinusUpper(S) {
    // можно убрать верхнюю, только если сейчас верхняя активна
    return S >= 5;
  }
  _canPlusLowerAfter(S, v) {
    // добавить v нижних без выхода за 4 нижних (когда верхняя НЕ активна)
    if (v < 1 || v > 4) return false;
    const L = this._L(S);
    return this._U(S) === 0 && (L + v) <= 4 && (S + v) <= 9;
  }

  /**
   * Программно строим все пары v->v2, которые реализуемы БРАТСКИМ обменом
   * через выбранные n (1..4).
   *
   * n = число нижних бусин в обмене.
   * "Вверх" (+delta, delta = 5-n):  [-n, +5]  возможен при L(S) ≥ n и U=0
   * "Вниз"  (-delta):                [-5, +n]  возможен при U=1
   */
  _buildBrotherPairs(digits) {
    const set = new Set();

    for (let v = 0; v <= 9; v++) {
      for (const n of digits) {
        const delta = 5 - n;

        // Вверх (+delta): убрать n нижних, опустить верхнюю
        if (this._U(v) === 0 && this._canMinusLower(v, n) && this._canPlusUpper(v - n)) {
          const v2 = v - n + 5;
          if (v2 >= 0 && v2 <= 9) {
            set.add(`${v}-${v2}-brother${n}`);
          }
        }

        // Вниз (-delta): убрать верхнюю, добавить n нижних
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
    // console.log("brotherPairs:", [...set]);
    return set;
  }

  /** Стартовое состояние стойки */
  generateStartState() {
    return 0;
  }

  /** Длина примера */
  generateStepsCount() {
    const { minSteps, maxSteps } = this.config;
    return minSteps + Math.floor(Math.random() * (maxSteps - minSteps + 1));
  }

  isValidState(v) {
    return v >= this.config.minState && v <= this.config.maxState;
  }

  /**
   * Все возможные действия из состояния v.
   * 🔥 ТОЛЬКО БРАТСКИЕ ШАГИ! Никаких простых переходов.
   * Для братских действий добавляем разложение formula: массив из двух атомарных операций.
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const { onlyAddition, onlySubtraction, brothersDigits } = this.config;
    const v = currentState;
    const brotherActions = [];

    // Проверяем все возможные переходы из текущего состояния
    for (let v2 = 0; v2 <= 9; v2++) {
      if (v2 === v) continue;
      const delta = v2 - v;
      const dir = delta > 0 ? "up" : "down";

      // Применяем ограничения направления
      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;
      if (isFirstAction && delta < 0) continue; // первый шаг не делаем минус

      // Проверяем братский переход по любому n
      let brotherN = null;
      for (const n of brothersDigits) {
        if (this.brotherPairs.has(`${v}-${v2}-brother${n}`)) {
          brotherN = n;
          break;
        }
      }

      // Добавляем ТОЛЬКО братские шаги
      if (brotherN != null) {
        const formula = this._buildBrotherFormula(v, v2, brotherN, dir);
        if (formula) {
          brotherActions.push({
            label: `через 5 (брат ${brotherN})`,
            value: delta,
            isBrother: true,
            brotherN,
            formula
          });
        }
      }
      // Простые шаги полностью игнорируем!
    }

    console.log(`🎲 Состояние ${v}: доступно ${brotherActions.length} братских шагов`);
    return brotherActions;
  }

  /**
   * Разложение братского шага в физические действия
   * up:   [-n (lower), +5 (upper)]
   * down: [-5 (upper), +n (lower)]
   */
  _buildBrotherFormula(v, v2, n, dir) {
    if (dir === "up") {
      // Проверки уже пройдены при построении пары
      return [
        { op: "-", val: n, source: "lower" },
        { op: "+", val: 5, source: "upper" }
      ];
    } else {
      return [
        { op: "-", val: 5, source: "upper" },
        { op: "+", val: n, source: "lower" }
      ];
    }
  }

  /** "Простой" переход без обмена верхней/нижних */
  _isSimpleTransition(v, v2, dir) {
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

  applyAction(currentState, action) {
    const delta = typeof action === "object" ? action.value : action;
    return currentState + delta;
  }

  formatAction(action) {
    const val = typeof action === "object" ? action.value : action;
    return val >= 0 ? `+${val}` : `${val}`;
  }

  validateExample(example) {
    const { start, steps, answer } = example;
    const { minState, maxState } = this.config;

    let s = start;
    let hasBrother = false;

    for (const step of steps) {
      const act = step.action ?? step; // на всякий случай
      s = this.applyAction(s, act);
      if (s < minState || s > maxState) return false;
      if (typeof act === "object" && act.isBrother) hasBrother = true;
    }

    if (s !== answer) return false;
    if (!hasBrother) return false;
    return true;
  }
}
