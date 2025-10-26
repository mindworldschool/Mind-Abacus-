// ext/core/rules/Simple9Rule.js - Правило "Просто 9" (комбинация 5+4)

import { BaseRule } from './BaseRule.js';

/**
 * Simple9Rule - правило "Просто 9"
 * Отрабатывает число 9 как комбинацию верхней бусины (5) и нижних (4)
 *
 * Особенности:
 * - Диапазон промежуточных состояний: 0-9
 * - Финальное состояние: 0-9 (должно закрыться)
 * - Композиция: +9 ≡ (+5, +4) или (+4, +5)
 * - Композиция: -9 ≡ (-5, -4) или (-4, -5)
 * - ОБЯЗАТЕЛЬНО: В примере должен быть блок ±9
 * - Физическое ограничение: +9 возможен только из 0; -9 возможен только из 9
 */
export class Simple9Rule extends BaseRule {
  constructor(config = {}) {
    super(config);

    this.name = "Просто 9";
    this.description = "Комбинация 5+4 (верхняя + 4 нижние)";

    // Конфигурация
    this.config = {
      minState: 0,
      maxState: 9,              // Промежуточные могут быть до 9
      maxFinalState: 9,         // Финал должен быть 0-9
      targetNumber: 9,          // Целевое число
      targetRemainder: 4,       // 9 = 5 + 4
      minSteps: config.minSteps || 2,
      maxSteps: config.maxSteps || 5,
      selectedDigits: config.selectedDigits || [4, 5, 9],
      requireBlock: config.requireBlock !== false, // по умолчанию true
      onlyAddition: config.onlyAddition || false,
      onlySubtraction: config.onlySubtraction || false,
      digitCount: config.digitCount || 1,
      combineLevels: config.combineLevels || false,
      ...config
    };

    console.log(`✅ Создано правило: ${this.name}, цифры: [${this.config.selectedDigits.join(', ')}], digitCount=${this.config.digitCount}, combineLevels=${this.config.combineLevels}`);
  }

  /**
   * Получает доступные действия с физической валидацией
   * @param {number|number[]} currentState - Текущее состояние
   * @param {boolean} isFirstAction - Первое ли это действие
   * @param {number} position - Для multi-digit: позиция разряда
   * @returns {Array<number|Object>} - Массив доступных действий
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const { selectedDigits, onlyAddition, onlySubtraction, digitCount } = this.config;

    // Получаем значение конкретного разряда
    const digitValue = this.getDigitValue(currentState, position);

    // Физическая модель абакуса для этого разряда
    const isUpperActive = (digitValue >= 5);
    const activeLower = isUpperActive ? digitValue - 5 : digitValue;
    const inactiveLower = 4 - activeLower;

    let validActions = [];

    // Проходим по выбранным цифрам
    for (const digit of selectedDigits) {
      // === ПОЛОЖИТЕЛЬНЫЕ ДЕЙСТВИЯ ===
      if (!onlySubtraction) {
        if (digit === 5) {
          // +5: верхняя НЕ активна и не выходим за 9
          if (!isUpperActive && (digitValue + 5 <= 9)) {
            validActions.push(5);
          }
        } else if (digit === 9) {
          // +9: верхняя не активна И есть все 4 свободные нижние (только из 0) и не выходим за 9
          if (!isUpperActive && inactiveLower >= 4 && digitValue === 0 && (digitValue + 9 <= 9)) {
            validActions.push(9);
          }
        } else if (digit < 5) {
          // +1..+4: есть достаточно свободных нижних и не выходим за 9
          if (inactiveLower >= digit && (digitValue + digit <= 9)) {
            validActions.push(digit);
          }
        }
      }

      // === ОТРИЦАТЕЛЬНЫЕ ДЕЙСТВИЯ ===
      if (!onlyAddition && !isFirstAction) {
        if (digit === 5) {
          // -5: верхняя активна и не уходим ниже 0
          if (isUpperActive && (digitValue - 5 >= 0)) {
            validActions.push(-5);
          }
        } else if (digit === 9) {
          // -9: верхняя активна И есть все 4 активные нижние (только из 9) и не уходим ниже 0
          if (isUpperActive && activeLower >= 4 && digitValue === 9 && (digitValue - 9 >= 0)) {
            validActions.push(-9);
          }
        } else if (digit < 5) {
          // -1..-4: есть активные нижние и не уходим ниже 0
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

    // ПРАВИЛО: из 0 только положительные
    if (digitValue === 0 && !isFirstAction) {
      validActions = validActions.filter(a => a > 0);
    }

    // Для multi-digit режима преобразуем действия в формат {position, value}
    if (digitCount && digitCount > 1) {
      validActions = validActions.map(value => ({ position, value }));
    }

    const stateStr = Array.isArray(currentState) ? `[${currentState.join(', ')}]` : currentState;
    console.log(`✅ Действия из ${stateStr} позиция ${position} (${this.name}, верх:${isUpperActive}, акт:${activeLower}, неакт:${inactiveLower}): [${validActions.map(a => typeof a === 'object' ? `{${a.position}:${a.value}}` : a).join(', ')}]`);

    return validActions;
  }

  /**
   * Проверяет возможность вставки блока ±9
   * @param {number} currentState - Текущее состояние
   * @param {boolean} isPositive - Положительный блок (+9) или отрицательный (-9)
   * @returns {boolean}
   */
  canInsertBlock(currentState, isPositive) {
    const { onlyAddition, onlySubtraction } = this.config;

    if (isPositive && onlySubtraction) return false;
    if (!isPositive && onlyAddition) return false;

    if (isPositive) {
      // +9 возможен только из 0
      // Условие: верхняя выключена и есть 4 свободные нижние (все)
      return currentState === 0;
    } else {
      // -9 возможен только из 9
      // Условие: верхняя включена и есть 4 активные нижние (все)
      return currentState === 9;
    }
  }

  /**
   * Генерирует блок ±9 (два шага)
   * @param {number} currentState - Текущее состояние
   * @param {boolean} isPositive - Положительный блок (+9) или отрицательный (-9)
   * @returns {Array|null} - Массив из двух действий [±5, ±4] или [±4, ±5], или null если невозможно
   */
  generateBlock(currentState, isPositive) {
    if (!this.canInsertBlock(currentState, isPositive)) {
      return null;
    }

    const r = this.config.targetRemainder; // 4 для режима 9

    if (isPositive) {
      // Случайный порядок: +5,+4 или +4,+5
      return Math.random() < 0.5
        ? [5, r]
        : [r, 5];
    } else {
      // Случайный порядок: -5,-4 или -4,-5
      return Math.random() < 0.5
        ? [-5, -r]
        : [-r, -5];
    }
  }

  /**
   * Проверяет наличие блока ±9 в шагах
   * @param {Array} steps - Массив шагов {action, fromState, toState}
   * @returns {boolean}
   */
  containsBlock(steps) {
    const r = this.config.targetRemainder; // 4

    for (let i = 0; i < steps.length - 1; i++) {
      const a1 = steps[i].action;
      const a2 = steps[i + 1].action;

      // +9: (+5, +4) или (+4, +5)
      if ((a1 === 5 && a2 === r) || (a1 === r && a2 === 5)) {
        return true;
      }

      // -9: (-5, -4) или (-4, -5)
      if ((a1 === -5 && a2 === -r) || (a1 === -r && a2 === -5)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Валидация примера
   * @param {Object} example - Пример {start, steps, answer}
   * @returns {boolean}
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { maxFinalState, requireBlock, digitCount } = this.config;

    // 1. Старт = 0 (число или массив нулей)
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

    // 3. Финал в диапазоне
    const answerNum = this.stateToNumber(answer);
    if (digitCount === 1) {
      // Для однозначных: 0-9
      if (answerNum > maxFinalState || answerNum < 0) {
        console.error(`❌ Финал ${answerNum} вне диапазона 0-${maxFinalState}`);
        return false;
      }
    } else {
      // Для многозначных: проверяем диапазон разрядности
      const minFinal = this.getMinFinalNumber();
      const maxFinal = this.getMaxFinalNumber();
      if (answerNum < minFinal || answerNum > maxFinal) {
        console.error(`❌ Финал ${answerNum} вне диапазона ${minFinal}-${maxFinal}`);
        return false;
      }
    }

    // 4. Проверка блока ±9 (если требуется)
    if (requireBlock) {
      const hasBlock = this.containsBlock(steps);
      if (!hasBlock) {
        console.error(`❌ Отсутствует блок ±9`);
        return false;
      }
    }

    // 5. Физическая валидация каждого шага
    let state = start;
    for (const step of steps) {
      const action = step.action;

      // Для multi-digit извлекаем position и value
      let position = 0;
      let actionValue = action;
      if (typeof action === 'object' && action !== null) {
        position = action.position;
        actionValue = action.value;
      }

      // Получаем значение конкретного разряда
      const digitValue = this.getDigitValue(state, position);

      const isUpperActive = (digitValue >= 5);
      const activeLower = isUpperActive ? digitValue - 5 : digitValue;
      const inactiveLower = 4 - activeLower;

      // Проверка физической возможности
      if (actionValue === 5) {
        if (isUpperActive) {
          console.error(`❌ Физически невозможно: +5 из ${digitValue} (верхняя уже активна) в разряде ${position}`);
          return false;
        }
      } else if (actionValue === -5) {
        if (!isUpperActive) {
          console.error(`❌ Физически невозможно: -5 из ${digitValue} (верхняя не активна) в разряде ${position}`);
          return false;
        }
      } else if (actionValue === 9) {
        // +9 требует: состояние = 0
        if (digitValue !== 0) {
          console.error(`❌ Физически невозможно: +9 из ${digitValue} (возможно только из 0) в разряде ${position}`);
          return false;
        }
      } else if (actionValue === -9) {
        // -9 требует: состояние = 9
        if (digitValue !== 9) {
          console.error(`❌ Физически невозможно: -9 из ${digitValue} (возможно только из 9) в разряде ${position}`);
          return false;
        }
      } else if (actionValue > 0 && actionValue < 5) {
        if (inactiveLower < actionValue) {
          console.error(`❌ Физически невозможно: +${actionValue} из ${digitValue} (свободно ${inactiveLower} < ${actionValue}) в разряде ${position}`);
          return false;
        }
      } else if (actionValue < 0 && actionValue > -5) {
        if (activeLower < Math.abs(actionValue)) {
          console.error(`❌ Физически невозможно: ${actionValue} из ${digitValue} (активно ${activeLower} < ${Math.abs(actionValue)}) в разряде ${position}`);
          return false;
        }
      }

      // Проверка состояния после действия
      if (!this.isValidState(step.toState)) {
        const stateStr = Array.isArray(step.toState) ? `[${step.toState.join(', ')}]` : step.toState;
        console.error(`❌ Промежуточное состояние ${stateStr} не валидно`);
        return false;
      }

      state = step.toState;
    }

    // 6. Расчётное состояние должно совпадать с ответом
    let calculatedState = start;
    for (const step of steps) {
      calculatedState = this.applyAction(calculatedState, step.action);
    }

    // Сравниваем числа, а не массивы
    const calcNum = this.stateToNumber(calculatedState);
    // answerNum уже объявлен выше
    if (calcNum !== answerNum) {
      console.error(`❌ Расчётное состояние ${calcNum} ≠ ответу ${answerNum}`);
      return false;
    }

    console.log(`✅ Пример валиден (${this.name}): ${steps.map(s => this.formatAction(s.action)).join(' ')} = ${answerNum}`);
    return true;
  }
}
