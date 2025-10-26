// ext/core/rules/Simple6Rule.js - Правило "Просто 6" (комбинация 5+1)

import { BaseRule } from './BaseRule.js';

/**
 * Simple6Rule - правило "Просто 6"
 * Отрабатывает число 6 как комбинацию верхней бусины (5) и нижних (1)
 *
 * Особенности:
 * - Диапазон промежуточных состояний: 0-9
 * - Финальное состояние: 0-6 (должно закрыться)
 * - Композиция: +6 ≡ (+5, +1) или (+1, +5)
 * - Композиция: -6 ≡ (-5, -1) или (-1, -5)
 * - ОБЯЗАТЕЛЬНО: В примере должен быть блок ±6
 * - Физическое ограничение: +6 возможен только из 0,1,2,3; -6 возможен из 6,7,8,9
 */
export class Simple6Rule extends BaseRule {
  constructor(config = {}) {
    super(config);

    this.name = "Просто 6";
    this.description = "Комбинация 5+1 (верхняя + 1 нижняя)";

    // Конфигурация
    this.config = {
      minState: 0,
      maxState: 9,              // Промежуточные могут быть до 9
      maxFinalState: 6,         // Финал должен быть 0-6
      targetNumber: 6,          // Целевое число
      targetRemainder: 1,       // 6 = 5 + 1
      minSteps: config.minSteps || 2,
      maxSteps: config.maxSteps || 5,
      selectedDigits: config.selectedDigits || [1, 5, 6],
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
        } else if (digit === 6) {
          // +6: верхняя не активна И есть хотя бы 1 свободная нижняя (из 0,1,2,3) и не выходим за 9
          if (!isUpperActive && inactiveLower >= 1 && (digitValue + 6 <= 9)) {
            validActions.push(6);
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
        } else if (digit === 6) {
          // -6: верхняя активна И есть хотя бы 1 активная нижняя и не уходим ниже 0
          if (isUpperActive && activeLower >= 1 && (digitValue - 6 >= 0)) {
            validActions.push(-6);
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

      // КРИТИЧНО: Для combineLevels=false не позволяем опускаться ниже минимального N-значного числа
      const combineLevels = this.config.combineLevels ?? false;
      if (!combineLevels) {
        const minFinal = this.getMinFinalNumber();

        // Фильтруем действия: оставляем только те, после которых число >= minFinal
        validActions = validActions.filter(action => {
          const newState = this.applyAction(currentState, action);
          const newNumber = this.stateToNumber(newState);
          return newNumber >= minFinal;
        });
      }
    }

    const stateStr = Array.isArray(currentState) ? `[${currentState.join(', ')}]` : currentState;
    console.log(`✅ Действия из ${stateStr} позиция ${position} (${this.name}, верх:${isUpperActive}, акт:${activeLower}, неакт:${inactiveLower}): [${validActions.map(a => typeof a === 'object' ? `{${a.position}:${a.value}}` : a).join(', ')}]`);

    return validActions;
  }

  /**
   * Проверяет возможность вставки блока ±6
   * @param {number} currentState - Текущее состояние
   * @param {boolean} isPositive - Положительный блок (+6) или отрицательный (-6)
   * @returns {boolean}
   */
  canInsertBlock(currentState, isPositive) {
    const { onlyAddition, onlySubtraction } = this.config;

    if (isPositive && onlySubtraction) return false;
    if (!isPositive && onlyAddition) return false;

    if (isPositive) {
      // +6 возможен из 0, 1, 2, 3
      // Условие: верхняя выключена и есть 1 свободная нижняя
      const isUpperActive = (currentState >= 5);
      const activeLower = isUpperActive ? currentState - 5 : currentState;
      const inactiveLower = 4 - activeLower;

      return !isUpperActive && inactiveLower >= 1 && (currentState + 6 <= 9);
    } else {
      // -6 возможен из 6, 7, 8, 9
      // Условие: верхняя включена и есть хотя бы 1 активная нижняя
      const isUpperActive = (currentState >= 5);
      const activeLower = isUpperActive ? currentState - 5 : currentState;

      return isUpperActive && activeLower >= 1 && (currentState - 6 >= 0);
    }
  }

  /**
   * Генерирует блок ±6 (два шага)
   * @param {number} currentState - Текущее состояние
   * @param {boolean} isPositive - Положительный блок (+6) или отрицательный (-6)
   * @returns {Array|null} - Массив из двух действий [±5, ±1] или [±1, ±5], или null если невозможно
   */
  generateBlock(currentState, isPositive) {
    if (!this.canInsertBlock(currentState, isPositive)) {
      return null;
    }

    const r = this.config.targetRemainder; // 1 для режима 6

    if (isPositive) {
      // Случайный порядок: +5,+1 или +1,+5
      return Math.random() < 0.5
        ? [5, r]
        : [r, 5];
    } else {
      // Случайный порядок: -5,-1 или -1,-5
      return Math.random() < 0.5
        ? [-5, -r]
        : [-r, -5];
    }
  }

  /**
   * Проверяет наличие блока ±6 в шагах
   * @param {Array} steps - Массив шагов {action, fromState, toState}
   * @returns {boolean}
   */
  containsBlock(steps) {
    const r = this.config.targetRemainder; // 1

    for (let i = 0; i < steps.length - 1; i++) {
      const a1 = steps[i].action;
      const a2 = steps[i + 1].action;

      // +6: (+5, +1) или (+1, +5)
      if ((a1 === 5 && a2 === r) || (a1 === r && a2 === 5)) {
        return true;
      }

      // -6: (-5, -1) или (-1, -5)
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
      // Для однозначных: 0-maxFinalState
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

    // 4. Проверка блока ±6 (если требуется)
    if (requireBlock) {
      const hasBlock = this.containsBlock(steps);
      if (!hasBlock) {
        console.error(`❌ Отсутствует блок ±6`);
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
      } else if (actionValue === 6) {
        // +6 требует: верхняя не активна, хотя бы 1 свободная нижняя
        if (isUpperActive || inactiveLower < 1) {
          console.error(`❌ Физически невозможно: +6 из ${digitValue} (верх:${isUpperActive}, свободно:${inactiveLower}) в разряде ${position}`);
          return false;
        }
      } else if (actionValue === -6) {
        // -6 требует: верхняя активна, хотя бы 1 активная нижняя
        if (!isUpperActive || activeLower < 1) {
          console.error(`❌ Физически невозможно: -6 из ${digitValue} (верх:${isUpperActive}, активно:${activeLower}) в разряде ${position}`);
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
