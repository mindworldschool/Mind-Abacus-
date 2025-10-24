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
getAvailableActions(currentState, isFirstAction = false, position = 0) {
  const { hasFive, selectedDigits, digitCount } = this.config;

  // Получаем значение конкретного разряда
  const digitValue = this.getDigitValue(currentState, position);

  // Определяем физическое состояние абакуса для этого разряда
  const isUpperActive = hasFive && (digitValue >= 5);
  const activeLower = isUpperActive ? digitValue - 5 : digitValue;
  const inactiveLower = 4 - activeLower;
  
  let validActions = [];

  // Проходим по всем выбранным цифрам
  for (const digit of selectedDigits) {
    // Положительные действия
    if (digit === 5 && hasFive) {
      // +5: верхняя не активна и не выходим за 9
      if (!isUpperActive && (digitValue + 5 <= 9)) {
        validActions.push(digit);
      }
    } else if (digit < 5) {
      // +1..+4: есть достаточно неактивных нижних и не выходим за 9
      if (inactiveLower >= digit && (digitValue + digit <= 9)) {
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
        // -1..-4: есть достаточно активных нижних и не уходим ниже 0
        if (activeLower >= digit && (digitValue - digit >= 0)) {
          validActions.push(-digit);
        }
      }
    }
  }
  
  // ПРАВИЛО: первое действие всегда положительное
  if (isFirstAction) {
    validActions = validActions.filter(a => a > 0);
  }

  // ПРАВИЛО: из 0 только положительные (для однозначных или конкретного разряда = 0)
  if (digitValue === 0 && !isFirstAction) {
    validActions = validActions.filter(a => a > 0);
  }

  // Если выбрана только 5 - приоритет ±5
  if (this.config.onlyFiveSelected && hasFive) {
    const only5 = validActions.filter(a => Math.abs(a) === 5);
    if (only5.length > 0) {
      validActions = only5;
    }
  }

  // Для multi-digit режима преобразуем действия в формат {position, value}
  if (digitCount && digitCount > 1) {
    validActions = validActions.map(value => ({ position, value }));
  }

  const stateStr = Array.isArray(currentState) ? `[${currentState.join(', ')}]` : currentState;
  console.log(`✅ Действия из ${stateStr} позиция ${position} (${this.name}): [${validActions.map(a => typeof a === 'object' ? `{${a.position}:${a.value}}` : a).join(', ')}]`);
  return validActions;
}
  /**
   * Валидация примера
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { maxFinalState, hasFive, digitCount } = this.config;

    // 1. Старт = 0 (или массив нулей)
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Начальное состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. Первое действие положительное
    if (steps.length > 0) {
      const firstAction = steps[0].action;
      const firstValue = typeof firstAction === 'object' ? firstAction.value : firstAction;
      if (firstValue <= 0) {
        console.error(`❌ Первое действие ${firstValue} не положительное`);
        return false;
      }
    }

    // 3. Финал должен быть в допустимом диапазоне
    const answerNum = this.stateToNumber(answer);
    const minFinal = this.getMinFinalNumber();
    const maxFinal = this.getMaxFinalNumber();

    // Для однозначных также проверяем maxFinalState (должно закрыться)
    if (digitCount === 1) {
      if (answerNum > maxFinalState || answerNum < 0) {
        console.error(`❌ Финал ${answerNum} вне диапазона 0-${maxFinalState}`);
        return false;
      }
    } else {
      // Для многозначных проверяем диапазон разрядности
      if (answerNum < minFinal || answerNum > maxFinal) {
        console.error(`❌ Финал ${answerNum} вне диапазона ${minFinal}-${maxFinal}`);
        return false;
      }
    }

    // 4. Все промежуточные состояния валидны
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const stateStr = Array.isArray(step.toState) ? `[${step.toState.join(', ')}]` : step.toState;
        console.error(`❌ Состояние ${stateStr} не валидно`);
        return false;
      }
    }

    // 5. Расчёт совпадает
    let calc = start;
    for (const step of steps) {
      calc = this.applyAction(calc, step.action);
    }

    // Сравниваем с учетом формата (число или массив)
    const calcNum = this.stateToNumber(calc);
    const answerNum = this.stateToNumber(answer);
    if (calcNum !== answerNum) {
      console.error(`❌ Расчёт ${calcNum} ≠ ответу ${answerNum}`);
      return false;
    }

    console.log(`✅ Пример валиден (${this.name})`);
    return true;
  }
}
