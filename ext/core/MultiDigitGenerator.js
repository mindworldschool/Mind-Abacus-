// ext/core/MultiDigitGenerator.js - Генератор многозначных примеров

/**
 * MultiDigitGenerator - класс-обёртка для генерации многозначных примеров.
 * 
 * Принимает любое правило (SimpleRule, BrothersRule, FriendsRule...) и применяет
 * его к каждому разряду НЕЗАВИСИМО, формируя многозначные числа.
 * 
 * КЛЮЧЕВЫЕ ОСОБЕННОСТИ:
 * 1. Каждый разряд живёт по правилам базового правила (физика абакуса)
 * 2. Использует ВЫБРАННЫЕ в настройках цифры (selectedDigits из config)
 * 3. Цифры в одном числе уникальны (например +21 ✅, +22 редко)
 * 4. Поддержка переменной разрядности (+389-27+164)
 * 5. Избегание нулевых разрядов (+20 максимум 1 раз)
 * 
 * ПРИМЕР 1 (выбрано [1,2,3,4,5]):
 * Разрядность: 2
 * Результат: +21+34-12+51 = 94
 * 
 * ПРИМЕР 2 (выбрано [1,2,3,4,5,6,7,8,9]):
 * Разрядность: 2
 * Результат: +19-76+82+34 = 59
 */

export class MultiDigitGenerator {
  /**
   * @param {Class} RuleClass - класс правила (UnifiedSimpleRule, BrothersRule...)
   * @param {number} maxDigitCount - максимальное количество разрядов (2-9)
   * @param {Object} config - конфигурация
   */
  constructor(RuleClass, maxDigitCount, config = {}) {
    // Создаём экземпляр базового правила с теми же настройками
    // selectedDigits берутся из config - пользователь выбирает их в UI
    this.baseRule = new RuleClass(config);
    this.maxDigitCount = Math.max(1, Math.min(9, maxDigitCount));
    
    this.config = {
      ...config,
      maxDigitCount: this.maxDigitCount,
      
      // Режим переменной разрядности (переключатель в UI)
      // true: +123-12+56 (разная длина чисел)
      // false: +123+456-789 (фиксированная длина)
      variableDigitCounts: config.variableDigitCounts ?? false,
      
      // Вероятность повторяющихся цифр (+22, +33) - редко!
      duplicateDigitProbability: 0.1, // 10% шанс
      
      // Максимум нулевых разрядов в примере (+20, +100)
      maxZeroDigits: 1,
      
      // Счётчики для контроля редких событий
      _duplicatesUsed: 0,
      _zeroDigitsUsed: 0
    };
    
    // Имя для логов
    this.name = `${this.baseRule.name} (Multi-Digit ${this.maxDigitCount})`;
    
    // Получаем selectedDigits из базового правила
    const selectedDigits = this.baseRule.config?.selectedDigits || [];
    
    console.log(`🔢 MultiDigitGenerator создан:
  Базовое правило: ${this.baseRule.name}
  Макс. разрядность: ${this.maxDigitCount}
  Выбранные цифры: [${selectedDigits.join(', ')}]
  Переменная разрядность: ${this.config.variableDigitCounts}
  Вероятность дубликатов: ${this.config.duplicateDigitProbability * 100}%
  Макс. нулевых разрядов: ${this.config.maxZeroDigits}`);
  }

  /**
   * Генерирует начальное состояние - массив нулей для каждого разряда
   * @returns {Array<number>} - [0, 0, 0, ...] (младший разряд первый)
   */
  generateStartState() {
    return Array(this.maxDigitCount).fill(0);
  }

  /**
   * Генерирует количество шагов (делегирует базовому правилу)
   * @returns {number}
   */
  generateStepsCount() {
    return this.baseRule.generateStepsCount();
  }

  /**
   * Главный метод генерации примера
   * @returns {Object} { start: [0,0,...], steps: [...], answer: [n,n,...] }
   */
  generateExample() {
    const states = this.generateStartState();
    const stepsCount = this.generateStepsCount();
    const steps = [];
    
    console.log(`🎯 Генерация многозначного примера: ${stepsCount} шагов, разрядов: ${this.maxDigitCount}`);
    
    // Сбрасываем счётчики редких событий
    this.config._duplicatesUsed = 0;
    this.config._zeroDigitsUsed = 0;
    
    for (let i = 0; i < stepsCount; i++) {
      const isFirst = i === 0;
      
      // Генерируем многозначное число
      const multiDigitAction = this._generateMultiDigitAction(states, isFirst, steps);
      
      if (!multiDigitAction) {
        console.warn(`⚠️ Не удалось сгенерировать шаг ${i + 1}, заканчиваем пример`);
        break;
      }
      
      // Применяем действие к каждому разряду
      const newStates = [...states];
      for (let pos = 0; pos < this.maxDigitCount; pos++) {
        const digitAction = multiDigitAction.digits[pos] || 0;
        newStates[pos] += digitAction;
      }
      
      steps.push({
        action: multiDigitAction.value,
        states: [...newStates],
        digits: multiDigitAction.digits
      });
      
      // Обновляем состояния
      for (let pos = 0; pos < this.maxDigitCount; pos++) {
        states[pos] = newStates[pos];
      }
      
      console.log(`  ✓ Шаг ${i + 1}: ${multiDigitAction.sign > 0 ? '+' : ''}${multiDigitAction.value}, состояния: [${states.join(', ')}]`);
    }
    
    return {
      start: this.generateStartState(),
      steps,
      answer: [...states]
    };
  }

  /**
   * Генерирует одно многозначное число (например +21, -345)
   * @param {Array<number>} states - текущие состояния разрядов
   * @param {boolean} isFirst - это первый шаг?
   * @param {Array} previousSteps - предыдущие шаги (для анализа)
   * @returns {Object|null} { value: 21, sign: 1, digits: [1, 2] }
   */
  _generateMultiDigitAction(states, isFirst, previousSteps) {
    const maxAttempts = 50;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Определяем количество разрядов для этого числа
        const digitCount = this._chooseDigitCount(isFirst);
        
        // Генерируем цифры для каждого разряда
        const result = this._generateDigits(states, digitCount, isFirst, previousSteps);
        
        if (!result) continue;
        
        // Проверяем валидность
        if (this._validateMultiDigitAction(result, states, isFirst)) {
          return result;
        }
      } catch (error) {
        if (attempt % 10 === 0) {
          console.warn(`  Попытка ${attempt}: ${error.message}`);
        }
      }
    }
    
    return null;
  }

  /**
   * Выбирает количество разрядов для текущего числа
   * @param {boolean} isFirst - первый шаг?
   * @returns {number} - количество разрядов (1..maxDigitCount)
   */
  _chooseDigitCount(isFirst) {
    // Первое число всегда максимальной разрядности
    if (isFirst) {
      return this.maxDigitCount;
    }
    
    // Режим фиксированной разрядности
    if (!this.config.variableDigitCounts) {
      return this.maxDigitCount;
    }
    
    // Режим переменной разрядности: случайно от 1 до maxDigitCount
    // С предпочтением более высоких разрядностей
    const weights = [];
    for (let i = 1; i <= this.maxDigitCount; i++) {
      // Больше вес для больших разрядностей
      const weight = i * i; // 1, 4, 9, 16, ...
      weights.push({ count: i, weight });
    }
    
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const w of weights) {
      random -= w.weight;
      if (random <= 0) {
        return w.count;
      }
    }
    
    return this.maxDigitCount;
  }

  /**
   * Генерирует цифры для каждого разряда
   * @param {Array<number>} states - текущие состояния
   * @param {number} digitCount - сколько разрядов использовать
   * @param {boolean} isFirst - первый шаг?
   * @param {Array} previousSteps - история шагов
   * @returns {Object|null}
   */
  _generateDigits(states, digitCount, isFirst, previousSteps) {
    const digits = Array(this.maxDigitCount).fill(0);
    const usedDigits = new Set();
    let hasNonZero = false;
    
    // Определяем знак (первый всегда +, остальные случайно)
    const sign = isFirst ? 1 : (Math.random() < 0.5 ? 1 : -1);
    
    // Позволяем ли дубликаты в этом числе?
    const allowDuplicates = Math.random() < this.config.duplicateDigitProbability
      && this.config._duplicatesUsed < 1; // Максимум 1 дубликат за весь пример
    
    // Генерируем цифры от старшего к младшему разряду
    for (let pos = this.maxDigitCount - 1; pos >= 0; pos--) {
      // Пропускаем разряды, которые не используем
      if (pos >= digitCount) {
        continue;
      }
      
      // Получаем доступные действия для этого разряда
      const currentState = states[pos];
      const isFirstForDigit = isFirst && pos === this.maxDigitCount - 1; // Первый только для старшего
      
      let availableActions = this.baseRule.getAvailableActions(
        currentState,
        isFirstForDigit,
        previousSteps
      );
      
      if (!availableActions || availableActions.length === 0) {
        // Нет доступных действий - оставляем 0
        continue;
      }
      
      // Фильтруем действия
      let filtered = availableActions.filter(action => {
        const value = this._getActionValue(action);
        const absValue = Math.abs(value);
        
        // Пропускаем 0
        if (absValue === 0) return false;
        
        // Проверяем направление (для не-первого шага)
        if (!isFirstForDigit) {
          if (sign > 0 && value < 0) return false;
          if (sign < 0 && value > 0) return false;
        }
        
        // Проверяем уникальность
        if (!allowDuplicates && usedDigits.has(absValue)) {
          return false;
        }
        
        return true;
      });
      
      if (filtered.length === 0) {
        // Если нет подходящих - пробуем с дубликатами
        if (!allowDuplicates) {
          filtered = availableActions.filter(action => {
            const value = this._getActionValue(action);
            const absValue = Math.abs(value);
            if (absValue === 0) return false;
            if (!isFirstForDigit) {
              if (sign > 0 && value < 0) return false;
              if (sign < 0 && value > 0) return false;
            }
            return true;
          });
        }
        
        if (filtered.length === 0) {
          continue; // Оставляем 0 для этого разряда
        }
      }
      
      // Выбираем случайное действие
      const action = this._chooseRandom(filtered);
      const value = this._getActionValue(action);
      const absValue = Math.abs(value);
      
      digits[pos] = sign * absValue;
      usedDigits.add(absValue);
      hasNonZero = true;
      
      // Отмечаем, что использовали дубликат
      if (allowDuplicates && usedDigits.size < pos + 1) {
        this.config._duplicatesUsed++;
      }
    }
    
    // Должно быть хотя бы одно ненулевое значение
    if (!hasNonZero) {
      return null;
    }
    
    // Считаем итоговое значение числа
    const value = digits.reduce((sum, digit, idx) => 
      sum + Math.abs(digit) * Math.pow(10, idx), 0
    );
    
    return {
      value,
      sign,
      digits,
      digitCount,
      usedDigits: Array.from(usedDigits)
    };
  }

  /**
   * Валидация сгенерированного многозначного числа
   */
  _validateMultiDigitAction(result, states, isFirst) {
    const { digits, value, sign } = result;
    
    // 1. Значение должно быть > 0
    if (value === 0) {
      return false;
    }
    
    // 2. Проверяем количество нулевых разрядов
    const zeroCount = digits.filter(d => d === 0).length;
    if (zeroCount > 0) {
      if (this.config._zeroDigitsUsed >= this.config.maxZeroDigits) {
        return false;
      }
      this.config._zeroDigitsUsed++;
    }
    
    // 3. Проверяем, что новые состояния валидны
    for (let pos = 0; pos < this.maxDigitCount; pos++) {
      const newState = states[pos] + digits[pos];
      if (newState < 0 || newState > 9) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Извлекает числовое значение из действия (может быть число или объект)
   */
  _getActionValue(action) {
    if (typeof action === 'object' && action !== null) {
      return action.value ?? 0;
    }
    return action;
  }

  /**
   * Выбирает случайный элемент из массива
   */
  _chooseRandom(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Применяет действие к состоянию
   * @param {Array<number>} state - массив состояний разрядов
   * @param {number|Object} action - действие (многозначное число или объект)
   * @returns {Array<number>}
   */
  applyAction(state, action) {
    if (typeof action === 'object' && action.digits) {
      // Объект с digits (из generateExample)
      const newState = [...state];
      for (let pos = 0; pos < this.maxDigitCount; pos++) {
        newState[pos] += (action.digits[pos] || 0);
      }
      return newState;
    }
    
    // Если число - раскладываем по разрядам
    const absValue = Math.abs(action);
    const sign = Math.sign(action);
    const digits = this._numberToDigits(absValue);
    
    const newState = [...state];
    for (let pos = 0; pos < this.maxDigitCount; pos++) {
      newState[pos] += sign * (digits[pos] || 0);
    }
    return newState;
  }

  /**
   * Раскладывает число на разряды
   * @param {number} num - число (например 123)
   * @returns {Array<number>} - [3, 2, 1] (младший разряд первый)
   */
  _numberToDigits(num) {
    const digits = [];
    let n = Math.abs(num);
    
    for (let i = 0; i < this.maxDigitCount; i++) {
      digits.push(n % 10);
      n = Math.floor(n / 10);
    }
    
    return digits;
  }

  /**
   * Преобразует состояние в число
   * @param {Array<number>} state - массив разрядов [3, 2, 1]
   * @returns {number} - число 123
   */
  stateToNumber(state) {
    if (!Array.isArray(state)) return 0;
    return state.reduce((sum, digit, idx) => 
      sum + digit * Math.pow(10, idx), 0
    );
  }

  /**
   * Проверяет валидность состояния
   * @param {Array<number>} state
   * @returns {boolean}
   */
  isValidState(state) {
    if (!Array.isArray(state)) return false;
    return state.every(digit => digit >= 0 && digit <= 9);
  }

  /**
   * Форматирует действие для UI
   * @param {number|Object} action
   * @returns {string}
   */
  formatAction(action) {
    const value = typeof action === 'object' ? action.value : action;
    return value >= 0 ? `+${value}` : `${value}`;
  }

  /**
   * Валидация готового примера
   * @param {Object} example
   * @returns {boolean}
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    
    // 1. Старт должен быть массивом нулей
    if (!Array.isArray(start) || start.some(s => s !== 0)) {
      console.error('❌ MultiDigit: стартовое состояние должно быть [0,0,...]');
      return false;
    }
    
    // 2. Проверяем каждый шаг
    let currentStates = [...start];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Первый шаг должен быть положительным
      if (i === 0 && step.action < 0) {
        console.error('❌ MultiDigit: первый шаг должен быть положительным');
        return false;
      }
      
      // Применяем шаг
      currentStates = this.applyAction(currentStates, step);
      
      // Проверяем валидность состояний
      if (!this.isValidState(currentStates)) {
        console.error(`❌ MultiDigit: шаг ${i + 1} привёл к невалидному состоянию [${currentStates.join(', ')}]`);
        return false;
      }
    }
    
    // 3. Финальное состояние должно совпадать с ответом
    const finalNumber = this.stateToNumber(currentStates);
    const answerNumber = this.stateToNumber(answer);
    
    if (finalNumber !== answerNumber) {
      console.error(`❌ MultiDigit: финал ${finalNumber} ≠ ответ ${answerNumber}`);
      return false;
    }
    
    console.log(`✅ MultiDigit: пример валиден (${steps.length} шагов, финал ${finalNumber})`);
    return true;
  }
}
