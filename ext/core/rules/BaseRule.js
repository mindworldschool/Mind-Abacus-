// ext/core/rules/BaseRule.js - Базовое правило для генерации примеров

/**
 * BaseRule - абстрактный базовый класс для всех правил генерации примеров
 * Определяет общую логику и интерфейс, который должны реализовать все правила
 */
export class BaseRule {
  constructor(config = {}) {
    this.name = "Базовое правило";
    this.description = "Базовая логика для всех правил";

    // Конфигурация по умолчанию
    this.config = {
      minState: 0,           // Минимальное состояние для каждого разряда
      maxState: 9,           // Максимальное состояние для каждого разряда
      minSteps: 1,           // Минимальное количество шагов
      maxSteps: 3,           // Максимальное количество шагов
      allowedActions: [],    // Разрешённые действия (будут установлены в наследниках)
      forbiddenActions: [],  // Запрещённые действия
      digitCount: 1,         // Количество разрядов (1=однозначные, 2=двузначные и т.д.)
      combineLevels: false,  // Комбинировать разряды в примерах
      ...config
    };
  }

  /**
   * Проверяет, является ли состояние валидным
   * @param {number|number[]} state - Состояние для проверки (число или массив разрядов)
   * @returns {boolean}
   */
  isValidState(state) {
    // Поддержка legacy формата (одно число)
    if (typeof state === 'number') {
      return state >= this.config.minState && state <= this.config.maxState;
    }

    // Новый формат (массив разрядов)
    if (Array.isArray(state)) {
      // Проверяем, что каждый разряд в диапазоне 0-9
      return state.every(digit =>
        digit >= this.config.minState && digit <= this.config.maxState
      );
    }

    return false;
  }

  /**
   * Применяет действие к состоянию
   * @param {number|number[]} state - Текущее состояние (число или массив разрядов)
   * @param {number|Object} action - Действие (число для legacy, {position, value} для multi-digit)
   * @returns {number|number[]} - Новое состояние
   */
  applyAction(state, action) {
    // Legacy формат: одно число + простое действие
    if (typeof state === 'number' && typeof action === 'number') {
      return state + action;
    }

    // Новый формат: массив разрядов + действие с позицией
    if (Array.isArray(state) && typeof action === 'object' && action !== null) {
      const { position, value } = action;
      const newState = [...state];
      newState[position] = (newState[position] || 0) + value;
      return newState;
    }

    // Если формат не распознан, возвращаем state без изменений
    console.error('⚠️ Неподдерживаемый формат applyAction:', { state, action });
    return state;
  }

  /**
   * Получает доступные действия для текущего состояния
   * @param {number|number[]} currentState - Текущее состояние (число или массив разрядов)
   * @param {boolean} isFirstAction - Является ли это первым действием
   * @param {number} position - Для multi-digit: позиция разряда (0=единицы, 1=десятки и т.д.)
   * @returns {Array<number|Object>} - Массив доступных действий
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const actions = [];

    for (const action of this.config.allowedActions) {
      if (this.isValidAction(currentState, action, position)) {
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Проверяет, является ли действие валидным для текущего состояния
   * @param {number|number[]} currentState - Текущее состояние
   * @param {number|Object} action - Действие для проверки
   * @param {number} position - Для multi-digit: позиция разряда
   * @returns {boolean}
   */
  isValidAction(currentState, action, position = 0) {
    // Legacy формат: простая проверка
    if (typeof action === 'number') {
      // Проверка: действие не запрещено
      if (this.config.forbiddenActions.includes(action)) {
        return false;
      }

      // Проверка: результат не выходит за границы
      const newState = this.applyAction(currentState, action);
      if (!this.isValidState(newState)) {
        return false;
      }

      return true;
    }

    // Новый формат: проверка с учетом позиции
    if (typeof action === 'object' && action !== null) {
      const newState = this.applyAction(currentState, action);
      if (!this.isValidState(newState)) {
        return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Генерирует начальное состояние
   * @returns {number|number[]} - Число или массив разрядов (все 0)
   */
  generateStartState() {
    const { digitCount } = this.config;

    // Legacy формат: одно число
    if (digitCount === 1) {
      return 0;
    }

    // Новый формат: массив разрядов, все начинаем с 0
    // [units, tens, hundreds, ...]
    return new Array(digitCount).fill(0);
  }

  /**
   * Генерирует количество шагов
   * @returns {number}
   */
  generateStepsCount() {
    const { minSteps, maxSteps } = this.config;
    return Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps;
  }

  /**
   * Форматирует действие для отображения
   * @param {number|Object} action - Действие
   * @returns {string} - Отформатированная строка (например, "+2" или "-1")
   */
  formatAction(action) {
    // Legacy формат
    if (typeof action === 'number') {
      return action > 0 ? `+${action}` : `${action}`;
    }

    // Новый формат: {position, value}
    if (typeof action === 'object' && action !== null) {
      const { position, value } = action;
      const sign = value > 0 ? '+' : '';
      return `${sign}${value}`;
    }

    return String(action);
  }

  /**
   * Helper: получить значение разряда из состояния
   * @param {number|number[]} state - Состояние
   * @param {number} position - Позиция разряда (0=единицы, 1=десятки и т.д.)
   * @returns {number} - Значение разряда (0-9)
   */
  getDigitValue(state, position = 0) {
    if (typeof state === 'number') {
      return position === 0 ? state : 0;
    }
    if (Array.isArray(state)) {
      return state[position] || 0;
    }
    return 0;
  }

  /**
   * Helper: преобразовать состояние в число
   * @param {number|number[]} state - Состояние
   * @returns {number} - Число
   */
  stateToNumber(state) {
    if (typeof state === 'number') {
      return state;
    }
    if (Array.isArray(state)) {
      // [units, tens, hundreds] -> число
      return state.reduce((sum, digit, index) => sum + digit * Math.pow(10, index), 0);
    }
    return 0;
  }

  /**
   * Helper: получить минимальное допустимое финальное число
   * Поддерживает любое количество разрядов от 1 до 9
   * @returns {number}
   */
  getMinFinalNumber() {
    const { digitCount, combineLevels } = this.config;

    if (digitCount === 1) {
      return 0;
    }

    // Без combineLevels: число должно иметь точно N разрядов
    if (!combineLevels) {
      // Минимальное N-значное число:
      // digitCount=2: 10, digitCount=3: 100, digitCount=4: 1000, ..., digitCount=9: 100000000
      return Math.pow(10, digitCount - 1);
    }

    // С combineLevels: допустимы числа от 1 до максимального N-значного
    return 1;
  }

  /**
   * Helper: получить максимальное допустимое финальное число
   * Поддерживает любое количество разрядов от 1 до 9
   * @returns {number}
   */
  getMaxFinalNumber() {
    const { digitCount } = this.config;

    if (digitCount === 1) {
      return 9;
    }

    // Максимальное N-значное число:
    // digitCount=2: 99, digitCount=3: 999, digitCount=4: 9999, ..., digitCount=9: 999999999
    return Math.pow(10, digitCount) - 1;
  }
}
