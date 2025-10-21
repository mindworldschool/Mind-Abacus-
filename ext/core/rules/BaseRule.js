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
      minState: 0,           // Минимальное состояние
      maxState: 9,           // Максимальное состояние
      minSteps: 1,           // Минимальное количество шагов
      maxSteps: 3,           // Максимальное количество шагов
      allowedActions: [],    // Разрешённые действия (будут установлены в наследниках)
      forbiddenActions: [],  // Запрещённые действия
      ...config
    };
  }

  /**
   * Проверяет, является ли состояние валидным
   * @param {number} state - Состояние для проверки
   * @returns {boolean}
   */
  isValidState(state) {
    return state >= this.config.minState && state <= this.config.maxState;
  }

  /**
   * Применяет действие к состоянию
   * @param {number} state - Текущее состояние
   * @param {number} action - Действие (например, +2 или -1)
   * @returns {number} - Новое состояние
   */
  applyAction(state, action) {
    return state + action;
  }

  /**
   * Получает доступные действия для текущего состояния
   * @param {number} currentState - Текущее состояние
   * @returns {number[]} - Массив доступных действий
   */
  getAvailableActions(currentState) {
    const actions = [];
    
    for (const action of this.config.allowedActions) {
      if (this.isValidAction(currentState, action)) {
        actions.push(action);
      }
    }
    
    return actions;
  }

  /**
   * Проверяет, является ли действие валидным для текущего состояния
   * @param {number} currentState - Текущее состояние
   * @param {number} action - Действие для проверки
   * @returns {boolean}
   */
  isValidAction(currentState, action) {
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

  /**
   * Генерирует начальное состояние
   * @returns {number}
   */
  generateStartState() {
    return 0; // По умолчанию начинаем с 0
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
   * @param {number} action - Действие
   * @returns {string} - Отформатированная строка (например, "+2" или "-1")
   */
  formatAction(action) {
    return action > 0 ? `+${action}` : `${action}`;
  }
}
