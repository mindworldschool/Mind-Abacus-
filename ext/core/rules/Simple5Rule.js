// ext/core/rules/Simple5Rule.js - Правило "Просто с 5"

import { SimpleRule } from './SimpleRule.js';

/**
 * Simple5Rule - правило "Просто" с верхней косточкой (0-9)
 * Расширяет SimpleRule, добавляя возможность использования ±5
 * 
 * Особенности:
 * - Все правила SimpleRule сохраняются
 * - Добавлены операции ±5 (верхняя косточка)
 * - Максимальное состояние: 9 (вместо 4)
 * - Промежуточные состояния могут быть > 5
 * - Финальное состояние: 0-5 (должно закрыться)
 * - ОБЯЗАТЕЛЬНО: В примере должно быть хотя бы одно ±5
 * - ФИЗИЧЕСКОЕ ОГРАНИЧЕНИЕ: Если состояние >= 5, нельзя добавлять +1,+2,+3,+4
 */
export class Simple5Rule extends SimpleRule {
  constructor(config = {}) {
    super(config);
    
    this.name = "Просто с 5";
    this.description = "Работа с нижними и верхней косточками (0-9), обязательно ±5";
    
    // Расширяем конфигурацию
    this.config = {
      ...this.config,
      maxState: 9,  // Можем доходить до 9 в промежуточных состояниях
      allowedActions: [1, 2, 3, 4, 5, -1, -2, -3, -4, -5], // Добавляем ±5
      forbiddenActions: [], // Убираем запрет на ±5
      maxFinalState: 5, // Финальное состояние не должно превышать 5
      mustHave5: true,  // В примере обязательно должно быть ±5
      ...config
    };
  }

  /**
   * Получает доступные действия с учётом физических ограничений
   * @param {number} currentState - Текущее состояние
   * @param {boolean} isFirstAction - Первое ли это действие
   * @returns {number[]} - Массив доступных действий (с весами)
   */
  getAvailableActions(currentState, isFirstAction = false) {
    let actions = super.getAvailableActions(currentState, isFirstAction);
    
    // Определяем физическое состояние
    const isUpperActive = (currentState >= 5);
    const activeLower = isUpperActive ? currentState - 5 : currentState;
    const inactiveLower = 4 - activeLower;
    
    // Фильтруем действия на основе физики
    let validActions = actions.filter(action => {
      if (action === 5) {
        // +5 только если верхняя НЕ активна и не выходим за 9
        return !isUpperActive && (currentState + 5 <= 9);
      } else if (action === -5) {
        // -5 только если верхняя активна
        return isUpperActive;
      } else if (action > 0 && action < 5) {
        // +1..+4 — только если есть достаточно НЕактивных нижних
        return inactiveLower >= action;
      } else if (action < 0 && action > -5) {
        // -1..-4 — только если есть достаточно АКТИВНЫХ нижних
        return activeLower >= Math.abs(action);
      }
      return true;
    });

    // ✅ Усиливаем вероятность ±5 «на порядок»
    // Вместо пяти дублей — десять (≈×10 к вероятности при прочих равных)
    const WEIGHT_5 = 10;
    const weighted = validActions.flatMap(a => (
      Math.abs(a) === 5 ? Array(WEIGHT_5).fill(a) : [a]
    ));

    // Фильтрация по выбранным цифрам
    const allowedMagnitudes = new Set(this.config && this.config.selectedDigits ? this.config.selectedDigits : [1,2,3,4,5]);
    let filteredByChoice = validActions.filter(a => allowedMagnitudes.has(Math.abs(a)));

    // Если выбрана только 5 и на шаге доступны ±5 — используем их
    if (this.config && this.config.onlyFiveSelected) {
      const only5 = filteredByChoice.filter(a => Math.abs(a) === 5);
      if (only5.length > 0) filteredByChoice = only5;
    }

    // Повторно применяем веса уже к отфильтрованным
    const weightedFinal = filteredByChoice.flatMap(a => (
      Math.abs(a) === 5 ? Array(WEIGHT_5).fill(a) : [a]
    ));

    console.log(`✅ Доступные действия из ${currentState} (верх:${isUpperActive}, акт:${activeLower}, неакт:${inactiveLower}): [${[...new Set(filteredByChoice)].join(', ')}]`);

    return weightedFinal;
  }

  /**
   * Валидация полного примера с учётом правил Simple5
   * @param {Object} example - Пример {start, steps, answer}
   * @returns {boolean}
   */
  validateExample(example) {
    // Сначала проверяем базовые правила SimpleRule
    // НО игнорируем проверку maxState, т.к. у нас maxState = 9
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
          
    // 4. Финальное состояние должно быть 0-5 (закрылся)
    if (answer > this.config.maxFinalState) {
      console.error(`❌ Финальное состояние ${answer} > 5 (не закрылся пример)`);
      return false;
    }
    
    if (answer < 0) {
      console.error(`❌ Финальное состояние ${answer} < 0`);
      return false;
    }
    
    // 5. Проверка физических ограничений по промежуточным состояниям
    for (const step of steps) {
      const state = step.fromState;
      const action = step.action;
      
      // Если состояние >= 5, нельзя добавлять +1,+2,+3,+4
      if (state >= 5 && action > 0 && action < 5) {
        console.error(`❌ Физически невозможно: из ${state} сделать ${this.formatAction(action)}`);
        return false;
      }
      
      // Проверка состояния после действия (должно быть 0-9)
      if (step.toState < 0 || step.toState > 9) {
        console.error(`❌ Промежуточное состояние ${step.toState} вне диапазона 0-9`);
        return false;
      }
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
    
    console.log(`✅ Пример валиден (Simple5): ${steps.map(s => this.formatAction(s.action)).join(' ')} = ${answer}`);
    return true;
  }
}
