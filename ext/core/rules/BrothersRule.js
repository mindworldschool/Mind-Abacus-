// ext/core/rules/BrothersRule.js - Правило "Братья" (пары к 5)

import { BaseRule } from './BaseRule.js';

export class BrothersRule extends BaseRule {
  constructor(config = {}) {
    super();
    
    this.config = {
      brothersDigitsAllowed: config.brothersDigitsAllowed || [1, 2, 3, 4],
      onlyAddition: config.onlyAddition || false,
      onlySubtraction: config.onlySubtraction || false,
      minSteps: config.minSteps || 3,
      maxSteps: config.maxSteps || 6,
      digitCount: 1,
      brotherPriority: 0.8  // 🔥 80% шанс выбрать братский шаг, если доступен
    };
    
    console.log('🎯 BrothersRule создан:', this.config);
  }

  get name() {
    return 'Братья';
  }

  generateStartState() {
    return Math.floor(Math.random() * 10);
  }

  generateStepsCount() {
    const min = this.config.minSteps;
    const max = this.config.maxSteps;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /**
   * 🔥 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: приоритизируем братские шаги
   */
  getAvailableActions(currentState, isFirstStep = false, position = 0) {
    const allActions = this._getAllPossibleActions(currentState, isFirstStep);
    
    // Разделяем на братские и обычные
    const brotherActions = allActions.filter(a => 
      typeof a === 'object' && a.isBrother
    );
    const simpleActions = allActions.filter(a => 
      typeof a === 'number' || (typeof a === 'object' && !a.isBrother)
    );
    
    // 🔥 Если есть братские шаги - приоритизируем их
    if (brotherActions.length > 0) {
      // С вероятностью brotherPriority возвращаем ТОЛЬКО братские
      if (Math.random() < this.config.brotherPriority) {
        console.log(`👬 Приоритет братским шагам (доступно ${brotherActions.length})`);
        return brotherActions;
      }
    }
    
    // Иначе возвращаем все доступные действия
    return allActions;
  }

  /**
   * Внутренний метод: получить ВСЕ возможные действия
   */
  _getAllPossibleActions(currentState, isFirstStep) {
    const actions = [];
    
    // Определяем допустимые знаки
    let allowedSigns = [];
    if (this.config.onlyAddition) {
      allowedSigns = [+1];
    } else if (this.config.onlySubtraction) {
      allowedSigns = [-1];
    } else {
      allowedSigns = isFirstStep ? [+1] : [+1, -1];
    }
    
    // Если состояние = 0, только положительные
    if (currentState === 0) {
      allowedSigns = [+1];
    }
    
    const { U, L } = this._decomposeState(currentState);
    
    for (const sign of allowedSigns) {
      if (sign > 0) {
        // === ПОЛОЖИТЕЛЬНЫЕ ДЕЙСТВИЯ ===
        
        // Простые +1..+4 (только нижние)
        for (let n = 1; n <= 4; n++) {
          if (L + n <= 4) {
            const newState = currentState + n;
            if (newState >= 0 && newState <= 9) {
              actions.push(n);
            }
          }
        }
        
        // +5 (верхняя)
        if (U === 0 && currentState <= 4) {
          actions.push(5);
        }
        
        // 🔥 Братские +1..+4 через +5
        for (const n of this.config.brothersDigitsAllowed) {
          if (this._canApplyBrotherStep(currentState, n, +1)) {
            actions.push(this._createBrotherAction(n, +1));
          }
        }
        
      } else {
        // === ОТРИЦАТЕЛЬНЫЕ ДЕЙСТВИЯ ===
        
        // Простые -1..-4 (только нижние)
        for (let n = 1; n <= 4; n++) {
          if (L >= n) {
            const newState = currentState - n;
            if (newState >= 0 && newState <= 9) {
              actions.push(-n);
            }
          }
        }
        
        // -5 (верхняя)
        if (U === 1 && currentState >= 5) {
          actions.push(-5);
        }
        
        // 🔥 Братские -1..-4 через -5
        for (const n of this.config.brothersDigitsAllowed) {
          if (this._canApplyBrotherStep(currentState, n, -1)) {
            actions.push(this._createBrotherAction(n, -1));
          }
        }
      }
    }
    
    return actions;
  }

  applyAction(currentState, action) {
    // Обычное числовое действие
    if (typeof action === 'number') {
      return currentState + action;
    }
    
    // Братское действие
    if (action.isBrother && action.formula) {
      let state = currentState;
      
      // Применяем каждый микрошаг
      for (const microStep of action.formula) {
        const delta = microStep.op === '+' ? microStep.val : -microStep.val;
        state += delta;
        
        if (state < 0 || state > 9) {
          throw new Error(
            `Братский шаг невозможен: промежуточное состояние ${state} выходит за [0..9]`
          );
        }
      }
      
      return state;
    }
    
    throw new Error(`Неизвестный тип действия: ${JSON.stringify(action)}`);
  }

  formatAction(action) {
    if (typeof action === 'number') {
      return action > 0 ? `+${action}` : `${action}`;
    }
    
    if (action.isBrother) {
      const val = action.value;
      return val > 0 ? `+${val}` : `${val}`;
    }
    
    return String(action);
  }

  stateToNumber(state) {
    return typeof state === 'number' ? state : 0;
  }

  /**
   * 🔥 УСИЛЕННАЯ ВАЛИДАЦИЯ: обязательно братский шаг из разрешённых
   */
  validateExample(example) {
    // Проверка 1: есть ли хотя бы один братский шаг?
    let hasBrotherStep = false;
    let usedBrotherNumbers = new Set();
    
    for (const step of example.steps) {
      const action = step.action;
      if (action && typeof action === 'object' && action.isBrother === true) {
        hasBrotherStep = true;
        if (action.brotherN) {
          usedBrotherNumbers.add(action.brotherN);
        }
      }
    }
    
    if (!hasBrotherStep) {
      console.warn('❌ Валидация: нет братских шагов');
      return false;
    }
    
    // Проверка 1.5: использован ли хотя бы один РАЗРЕШЁННЫЙ брат?
    const hasAllowedBrother = Array.from(usedBrotherNumbers).some(n => 
      this.config.brothersDigitsAllowed.includes(n)
    );
    
    if (!hasAllowedBrother) {
      console.warn('❌ Валидация: нет братских шагов из разрешённых', {
        использовано: Array.from(usedBrotherNumbers),
        разрешено: this.config.brothersDigitsAllowed
      });
      return false;
    }
    
    // Проверка 2: все промежуточные состояния [0..9]
    for (let i = 0; i < example.steps.length; i++) {
      const state = example.steps[i].toState;
      if (state < 0 || state > 9) {
        console.warn(`❌ Валидация: шаг ${i + 1} выходит за диапазон (${state})`);
        return false;
      }
    }
    
    // Проверка 3: финальный ответ [0..9]
    if (example.answer < 0 || example.answer > 9) {
      console.warn(`❌ Валидация: финальный ответ ${example.answer} выходит за [0..9]`);
      return false;
    }
    
    // Проверка 4: ограничения на знаки
    if (this.config.onlyAddition || this.config.onlySubtraction) {
      for (const step of example.steps) {
        const action = step.action;
        const value = typeof action === 'number' 
          ? action 
          : (action.value || 0);
        
        if (this.config.onlyAddition && value < 0) {
          console.warn('❌ Валидация: отрицательный шаг при onlyAddition');
          return false;
        }
        
        if (this.config.onlySubtraction && value > 0) {
          console.warn('❌ Валидация: положительный шаг при onlySubtraction');
          return false;
        }
      }
    }
    
    console.log(`✅ Валидация пройдена! Использованы братья: [${Array.from(usedBrotherNumbers).join(', ')}]`);
    return true;
  }

  // ==================== ПРИВАТНЫЕ МЕТОДЫ ====================

  _decomposeState(state) {
    const U = state >= 5 ? 1 : 0;
    const L = state % 5;
    return { U, L };
  }

  _canApplyBrotherStep(currentState, n, sign) {
    const brotherValue = 5 - n;
    const { U, L } = this._decomposeState(currentState);
    
    if (sign > 0) {
      // +N = +5 - brotherValue
      
      // Шаг 1: можно ли +5?
      if (U === 1) return false;
      if (currentState > 4) return false;
      
      const afterAdd5 = currentState + 5;
      const { L: L1 } = this._decomposeState(afterAdd5);
      
      // Шаг 2: можно ли -brotherValue?
      if (L1 < brotherValue) return false;
      
      const finalState = afterAdd5 - brotherValue;
      if (finalState < 0 || finalState > 9) return false;
      
      return true;
      
    } else {
      // -N = -5 + brotherValue
      
      // Шаг 1: можно ли -5?
      if (U === 0) return false;
      if (currentState < 5) return false;
      
      const afterSub5 = currentState - 5;
      const { L: L1 } = this._decomposeState(afterSub5);
      
      // Шаг 2: можно ли +brotherValue?
      if (L1 + brotherValue > 4) return false;
      
      const finalState = afterSub5 + brotherValue;
      if (finalState < 0 || finalState > 9) return false;
      
      return true;
    }
  }

  _createBrotherAction(n, sign) {
    const brotherValue = 5 - n;
    
    if (sign > 0) {
      // +N = +5 - brotherValue
      return {
        value: n,
        isBrother: true,
        brotherN: n,
        formula: [
          { op: '+', val: 5 },
          { op: '-', val: brotherValue }
        ]
      };
    } else {
      // -N = -5 + brotherValue
      return {
        value: -n,
        isBrother: true,
        brotherN: n,
        formula: [
          { op: '-', val: 5 },
          { op: '+', val: brotherValue }
        ]
      };
    }
  }
}
