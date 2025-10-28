// ext/core/rules/SimpleRule.js - Правило "Просто" (работа с нижними косточками 0-4)

import { BaseRule } from './BaseRule.js';

/**
 * SimpleRule - правило "Просто"
 * Работа только с нижними косточками абакуса (0-4)
 * БЕЗ использования верхней косточки (±5 запрещены)
 * 
 * Особенности:
 * - Первое действие ВСЕГДА положительное (+1, +2, +3, +4)
 * - Все промежуточные состояния: 0-4
 * - Если промежуточное состояние = 0, следующее действие только положительное
 * - Финальное состояние: 0-4
 * - Ноль НЕ показывается в начале примера
 */
export class SimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);
    
    this.name = "Просто";
    this.description = "Работа только с нижними косточками (0-4), без ±5";
    
    // Настройки по умолчанию для правила "Просто"
    this.config = {
      minState: 0,
      maxState: 4,
      minSteps: 1,
      maxSteps: 3,
      allowedActions: [1, 2, 3, 4, -1, -2, -3, -4],
      forbiddenActions: [5, -5], // Запрещены операции с верхней косточкой
      firstActionMustBePositive: true, // КРИТИЧНО: первое действие всегда положительное
      ...config
    };
  }

  /**
   * Получает доступные действия с учётом ВСЕХ правил
   * @param {number} currentState - Текущее состояние
   * @param {boolean} isFirstAction - Первое ли это действие в цепочке
   * @returns {number[]} - Массив доступных действий
   */
 getAvailableActions(currentState, isFirstAction = false) {
  let actions = super.getAvailableActions(currentState);
  
  // Определяем физическое состояние для нижних бусин
  const activeLower = currentState;
  const inactiveLower = 4 - activeLower;
  
  // Фильтруем действия на основе физики
  actions = actions.filter(action => {
    if (action > 0) {
      // Прибавление: нужны неактивные нижние
      return inactiveLower >= action;
    } else {
      // Вычитание: нужны активные нижние
      return activeLower >= Math.abs(action);
    }
  });
  
  // ПРАВИЛО 1: Первое действие всегда положительное
  if (isFirstAction && this.config.firstActionMustBePositive) {
    actions = actions.filter(action => action > 0);
    console.log(`🎯 Первое действие: [${actions.join(', ')}]`);
  }
  
  // ПРАВИЛО 2: Если состояние = 0, следующее действие только положительное
  if (currentState === 0 && !isFirstAction) {
    actions = actions.filter(action => action > 0);
    console.log(`⚠️ Состояние 0 → доступны только положительные: [${actions.join(', ')}]`);
  }
  
  console.log(`✅ Доступные действия из ${currentState} (акт:${activeLower}, неакт:${inactiveLower}): [${actions.join(', ')}]`);
  const allowedMagnitudes = new Set(this.config && this.config.selectedDigits ? this.config.selectedDigits : [1,2,3,4]);
  const filteredByChoice = actions.filter(a => allowedMagnitudes.has(Math.abs(a)));
  return filteredByChoice;
}
  /**
   * Валидация полного примера
   * @param {Object} example - Пример {start, steps, answer}
   * @returns {boolean}
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    
    // 1. Начальное состояние должно быть 0
    if (start !== 0) {
      console.error(`❌ Начальное состояние ${start} ≠ 0`);
      return false;
    }
    
    // 2. Первое действие должно быть положительным
    if (steps.length > 0 && steps[0].action <= 0) {
      console.error(`❌ Первое действие ${steps[0].action} не положительное`);
      return false;
    }
    
    // 3. Все промежуточные состояния должны быть 0-4
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        console.error(`❌ Состояние ${step.toState} вне диапазона 0-4`);
        return false;
      }
      
      // Если промежуточное состояние = 0, следующее действие должно быть положительным
      if (step.toState === 0) {
        const nextStep = steps[steps.indexOf(step) + 1];
        if (nextStep && nextStep.action <= 0) {
          console.error(`❌ После состояния 0 действие ${nextStep.action} не положительное`);
          return false;
        }
      }
    }
    
    // 4. Финальное состояние должно быть 0-4
    if (!this.isValidState(answer)) {
      console.error(`❌ Финальное состояние ${answer} вне диапазона 0-4`);
      return false;
    }
    
    // 5. Расчётное состояние должно совпадать с ответом
    let calculatedState = start;
    for (const step of steps) {
      calculatedState = this.applyAction(calculatedState, step.action);
    }
    
    if (calculatedState !== answer) {
      console.error(`❌ Расчётное состояние ${calculatedState} ≠ ответу ${answer}`);
      return false;
    }
    
    console.log(`✅ Пример валиден: ${steps.map(s => this.formatAction(s.action)).join(' ')} = ${answer}`);
    return true;
  }
}

