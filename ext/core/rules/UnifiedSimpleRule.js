// ext/core/rules/UnifiedSimpleRule.js - Унифицированное правило для 1-5

import { BaseRule } from './BaseRule.js';

/**
 * UnifiedSimpleRule - единое правило для работы с цифрами 1-5
 * Автоматически определяет нужна ли верхняя косточка по выбранным цифрам
 */
export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);
    
    // Определяем, какие цифры выбраны
    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];
    const hasFive = selectedDigits.includes(5);
    
    this.name = hasFive ? "Просто с 5" : "Просто";
    this.description = hasFive 
      ? "Работа с нижними и верхней косточками (0-9)" 
      : "Работа только с нижними косточками (0-4)";
    
    // Настройки
    this.config = {
      minState: 0,
      maxState: hasFive ? 9 : 4,
      maxFinalState: hasFive ? 5 : 4,
      minSteps: config.minSteps || 2,
      maxSteps: config.maxSteps || 4,
      selectedDigits: selectedDigits,
      hasFive: hasFive,
      onlyFiveSelected: config.onlyFiveSelected || false,
      firstActionMustBePositive: true
    };
    
    console.log(`✅ Создано правило: ${this.name}, цифры: [${selectedDigits.join(', ')}]`);
  }

/**
 * Получает доступные действия с учётом физики абакуса
 */
getAvailableActions(currentState, isFirstAction = false) {
  const { hasFive, selectedDigits } = this.config;
  
  // Определяем физическое состояние абакуса
  const isUpperActive = hasFive && (currentState >= 5);
  const activeLower = isUpperActive ? currentState - 5 : currentState;
  const inactiveLower = 4 - activeLower;
  
  let validActions = [];
  
  // Проходим по всем выбранным цифрам
  for (const digit of selectedDigits) {
    // Положительные действия
    if (digit === 5 && hasFive) {
      // +5: верхняя не активна и не выходим за 9
      if (!isUpperActive && (currentState + 5 <= 9)) {
        validActions.push(5);
      }
    } else if (digit < 5) {
      // +1..+4: есть достаточно неактивных нижних
      if (inactiveLower >= digit) {
        validActions.push(digit);
      }
    }
    
    // Отрицательные действия (только если не первое)
    if (!isFirstAction) {
      if (digit === 5 && hasFive) {
        // -5: верхняя активна
        if (isUpperActive) {
          validActions.push(-5);
        }
      } else if (digit < 5) {
        // -1..-4: есть достаточно активных нижних
        if (activeLower >= digit) {
          validActions.push(-digit);
        }
      }
    }
  }
  
  // ПРАВИЛО: первое действие всегда положительное
  if (isFirstAction) {
    validActions = validActions.filter(a => a > 0);
  }
  
  // ПРАВИЛО: из 0 только положительные
  if (currentState === 0 && !isFirstAction) {
    validActions = validActions.filter(a => a > 0);
  }
  
  // Если выбрана только 5 - приоритет ±5
  if (this.config.onlyFiveSelected && hasFive) {
    const only5 = validActions.filter(a => Math.abs(a) === 5);
    if (only5.length > 0) {
      validActions = only5;
    }
  }
  
  console.log(`✅ Действия из ${currentState} (${this.name}): [${validActions.join(', ')}]`);
  return validActions;
}
  /**
   * Валидация примера
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { maxFinalState, hasFive } = this.config;
    
    // 1. Старт = 0
    if (start !== 0) {
      console.error(`❌ Начальное состояние ${start} ≠ 0`);
      return false;
    }
    
    // 2. Первое действие положительное
    if (steps.length > 0 && steps[0].action <= 0) {
      console.error(`❌ Первое действие ${steps[0].action} не положительное`);
      return false;
    }
    
    // 3. Финал должен закрыться
    if (answer > maxFinalState || answer < 0) {
      console.error(`❌ Финал ${answer} вне диапазона 0-${maxFinalState}`);
      return false;
    }
    
    // 4. Все промежуточные состояния валидны
    for (const step of steps) {
      if (step.toState < 0 || step.toState > this.config.maxState) {
        console.error(`❌ Состояние ${step.toState} вне диапазона`);
        return false;
      }
    }
    
    // 5. Расчёт совпадает
    let calc = start;
    for (const step of steps) {
      calc += step.action;
    }
    if (calc !== answer) {
      console.error(`❌ Расчёт ${calc} ≠ ответу ${answer}`);
      return false;
    }
    
    console.log(`✅ Пример валиден (${this.name})`);
    return true;
  }
}
