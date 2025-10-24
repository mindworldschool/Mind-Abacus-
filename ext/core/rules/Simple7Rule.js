// ext/core/rules/Simple7Rule.js - Правило "Просто 7" (комбинация 5+2)

import { BaseRule } from './BaseRule.js';

/**
 * Simple7Rule - правило "Просто 7"
 * Отрабатывает число 7 как комбинацию верхней бусины (5) и нижних (2)
 *
 * Особенности:
 * - Диапазон промежуточных состояний: 0-9
 * - Финальное состояние: 0-7 (должно закрыться)
 * - Композиция: +7 ≡ (+5, +2) или (+2, +5)
 * - Композиция: -7 ≡ (-5, -2) или (-2, -5)
 * - ОБЯЗАТЕЛЬНО: В примере должен быть блок ±7
 * - Физическое ограничение: +7 возможен только из 0,1,2; -7 возможен из 7,8,9
 */
export class Simple7Rule extends BaseRule {
  constructor(config = {}) {
    super(config);

    this.name = "Просто 7";
    this.description = "Комбинация 5+2 (верхняя + 2 нижние)";

    // Конфигурация
    this.config = {
      minState: 0,
      maxState: 9,              // Промежуточные могут быть до 9
      maxFinalState: 7,         // Финал должен быть 0-7
      targetNumber: 7,          // Целевое число
      targetRemainder: 2,       // 7 = 5 + 2
      minSteps: config.minSteps || 2,
      maxSteps: config.maxSteps || 5,
      selectedDigits: config.selectedDigits || [2, 5, 7],
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
        } else if (digit === 7) {
          // +7: верхняя не активна И есть хотя бы 2 свободные нижние и не выходим за 9
          if (!isUpperActive && inactiveLower >= 2 && (digitValue + 7 <= 9)) {
            validActions.push(7);
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
        } else if (digit === 7) {
          // -7: верхняя активна И есть хотя бы 2 активные нижние и не уходим ниже 0
          if (isUpperActive && activeLower >= 2 && (digitValue - 7 >= 0)) {
            validActions.push(-7);
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
   * Проверяет возможность вставки блока ±7
   * @param {number} currentState - Текущее состояние
   * @param {boolean} isPositive - Положительный блок (+7) или отрицательный (-7)
   * @returns {boolean}
   */
  canInsertBlock(currentState, isPositive) {
    const { onlyAddition, onlySubtraction } = this.config;

    if (isPositive && onlySubtraction) return false;
    if (!isPositive && onlyAddition) return false;

    if (isPositive) {
      // +7 возможен из 0, 1, 2
      // Условие: верхняя выключена и есть 2 свободные нижние
      const isUpperActive = (currentState >= 5);
      const activeLower = isUpperActive ? currentState - 5 : currentState;
      const inactiveLower = 4 - activeLower;

      return !isUpperActive && inactiveLower >= 2 && (currentState + 7 <= 9);
    } else {
      // -7 возможен из 7, 8, 9
      // Условие: верхняя включена и есть хотя бы 2 активные нижние
      const isUpperActive = (currentState >= 5);
      const activeLower = isUpperActive ? currentState - 5 : currentState;

      return isUpperActive && activeLower >= 2 && (currentState - 7 >= 0);
    }
  }

  /**
   * Генерирует блок ±7 (два шага)
   * @param {number} currentState - Текущее состояние
   * @param {boolean} isPositive - Положительный блок (+7) или отрицательный (-7)
   * @returns {Array|null} - Массив из двух действий [±5, ±2] или [±2, ±5], или null если невозможно
   */
  generateBlock(currentState, isPositive) {
    if (!this.canInsertBlock(currentState, isPositive)) {
      return null;
    }

    const r = this.config.targetRemainder; // 2 для режима 7

    if (isPositive) {
      // Случайный порядок: +5,+2 или +2,+5
      return Math.random() < 0.5
        ? [5, r]
        : [r, 5];
    } else {
      // Случайный порядок: -5,-2 или -2,-5
      return Math.random() < 0.5
        ? [-5, -r]
        : [-r, -5];
    }
  }

  /**
   * Проверяет наличие блока ±7 в шагах
   * @param {Array} steps - Массив шагов {action, fromState, toState}
   * @returns {boolean}
   */
  containsBlock(steps) {
    const r = this.config.targetRemainder; // 2

    for (let i = 0; i < steps.length - 1; i++) {
      const a1 = steps[i].action;
      const a2 = steps[i + 1].action;

      // +7: (+5, +2) или (+2, +5)
      if ((a1 === 5 && a2 === r) || (a1 === r && a2 === 5)) {
        return true;
      }

      // -7: (-5, -2) или (-2, -5)
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
    const { maxFinalState, requireBlock } = this.config;

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

    // 3. Финал в диапазоне 0-7
    if (answer > maxFinalState || answer < 0) {
      console.error(`❌ Финал ${answer} вне диапазона 0-${maxFinalState}`);
      return false;
    }

    // 4. Проверка блока ±7 (если требуется)
    if (requireBlock) {
      const hasBlock = this.containsBlock(steps);
      if (!hasBlock) {
        console.error(`❌ Отсутствует блок ±7`);
        return false;
      }
    }

    // 5. Физическая валидация каждого шага
    let state = start;
    for (const step of steps) {
      const isUpperActive = (state >= 5);
      const activeLower = isUpperActive ? state - 5 : state;
      const inactiveLower = 4 - activeLower;
      const action = step.action;

      // Проверка физической возможности
      if (action === 5) {
        if (isUpperActive) {
          console.error(`❌ Физически невозможно: +5 из ${state} (верхняя уже активна)`);
          return false;
        }
      } else if (action === -5) {
        if (!isUpperActive) {
          console.error(`❌ Физически невозможно: -5 из ${state} (верхняя не активна)`);
          return false;
        }
      } else if (action === 7) {
        // +7 требует: верхняя не активна, хотя бы 2 свободные нижние
        if (isUpperActive || inactiveLower < 2) {
          console.error(`❌ Физически невозможно: +7 из ${state} (верх:${isUpperActive}, свободно:${inactiveLower})`);
          return false;
        }
      } else if (action === -7) {
        // -7 требует: верхняя активна, хотя бы 2 активные нижние
        if (!isUpperActive || activeLower < 2) {
          console.error(`❌ Физически невозможно: -7 из ${state} (верх:${isUpperActive}, активно:${activeLower})`);
          return false;
        }
      } else if (action > 0 && action < 5) {
        if (inactiveLower < action) {
          console.error(`❌ Физически невозможно: +${action} из ${state} (свободно ${inactiveLower} < ${action})`);
          return false;
        }
      } else if (action < 0 && action > -5) {
        if (activeLower < Math.abs(action)) {
          console.error(`❌ Физически невозможно: ${action} из ${state} (активно ${activeLower} < ${Math.abs(action)})`);
          return false;
        }
      }

      // Проверка состояния после действия
      if (step.toState < 0 || step.toState > 9) {
        console.error(`❌ Промежуточное состояние ${step.toState} вне диапазона 0-9`);
        return false;
      }

      state = step.toState;
    }

    // 6. Расчётное состояние должно совпадать с ответом
    let calculatedState = start;
    for (const step of steps) {
      calculatedState = this.applyAction(calculatedState, step.action);
    }

    if (calculatedState !== answer) {
      console.error(`❌ Расчётное состояние ${calculatedState} ≠ ответу ${answer}`);
      return false;
    }

    console.log(`✅ Пример валиден (${this.name}): ${steps.map(s => this.formatAction(s.action)).join(' ')} = ${answer}`);
    return true;
  }
}
