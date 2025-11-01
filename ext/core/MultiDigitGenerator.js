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
    
    // ВАЖНО: Количество разрядов в ПРИМЕРЕ (что показываем пользователю)
    this.displayDigitCount = Math.max(1, Math.min(9, maxDigitCount));
    
    // ВАЖНО: Абакус всегда на 1 разряд БОЛЬШЕ для переноса!
    this.maxDigitCount = this.displayDigitCount + 1;
    
    console.log(`📊 Разрядность: пример=${this.displayDigitCount}, абакус=${this.maxDigitCount}`);
    
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
    this.name = `${this.baseRule.name} (Multi-Digit ${this.displayDigitCount})`;
    
    // Получаем selectedDigits из базового правила
    const selectedDigits = this.baseRule.config?.selectedDigits || [];
    
    console.log(`🔢 MultiDigitGenerator создан:
  Базовое правило: ${this.baseRule.name}
  Разрядность примера: ${this.displayDigitCount}
  Разрядность абакуса: ${this.maxDigitCount} (+1 для переноса)
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
    
    console.log(`🎯 Генерация многозначного примера: ${stepsCount} шагов, разрядов: ${this.displayDigitCount} (абакус: ${this.maxDigitCount})`);
    
    // Сбрасываем счётчики редких событий
    this.config._duplicatesUsed = 0;
    this.config._zeroDigitsUsed = 0;
    
    // ВАЖНО: Гарантируем нужное количество шагов!
    let attempts = 0;
    const maxTotalAttempts = 1000; // Максимум попыток для всего примера
    
    while (steps.length < stepsCount && attempts < maxTotalAttempts) {
      attempts++;
      const isFirst = steps.length === 0;
      
      // Генерируем многозначное число
      const multiDigitAction = this._generateMultiDigitAction(states, isFirst, steps);
      
      if (!multiDigitAction) {
        // Не удалось - пробуем ещё раз
        if (attempts % 50 === 0) {
          console.warn(`⚠️ Попытка ${attempts}: не удалось сгенерировать шаг ${steps.length + 1}`);
        }
        continue;
      }
      
      // Применяем действие к каждому разряду
      const newStates = [...states];
      for (let pos = 0; pos < this.maxDigitCount; pos++) {
        const digitAction = multiDigitAction.digits[pos] || 0;
        newStates[pos] += digitAction;
      }
      
      // Проверяем валидность новых состояний
      let allValid = true;
      for (let pos = 0; pos < this.maxDigitCount; pos++) {
        if (newStates[pos] < 0 || newStates[pos] > 9) {
          allValid = false;
          console.warn(`⚠️ Разряд ${pos}: состояние ${newStates[pos]} выходит за 0-9`);
          break;
        }
      }
      
      if (!allValid) {
        // Невалидное состояние - пробуем ещё раз
        continue;
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
      
      console.log(`  ✅ Шаг ${steps.length}/${stepsCount}: ${multiDigitAction.sign > 0 ? '+' : ''}${multiDigitAction.value}, состояния: [${states.slice(0, this.displayDigitCount + 1).join(', ')}]`);
    }
    
    if (steps.length < stepsCount) {
      console.warn(`⚠️ Удалось сгенерировать только ${steps.length} из ${stepsCount} шагов за ${attempts} попыток`);
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
    const maxAttempts = 100; // Увеличено с 50 до 100
    
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
        if (attempt % 20 === 0) {
          console.warn(`  Попытка ${attempt}: ${error.message}`);
        }
      }
    }
    
    console.warn(`⚠️ Не удалось сгенерировать действие за ${maxAttempts} попыток, состояния: [${states.join(', ')}]`);
    return null;
  }

  /**
   * Выбирает количество разрядов для текущего числа
   * @param {boolean} isFirst - первый шаг?
   * @returns {number} - количество разрядов (1..displayDigitCount)
   */
  _chooseDigitCount(isFirst) {
    // Первое число всегда максимальной разрядности
    if (isFirst) {
      return this.displayDigitCount;
    }
    
    // Режим фиксированной разрядности
    if (!this.config.variableDigitCounts) {
      return this.displayDigitCount;
    }
    
    // Режим переменной разрядности: случайно от 1 до displayDigitCount
    // С предпочтением более высоких разрядностей
    const weights = [];
    for (let i = 1; i <= this.displayDigitCount; i++) {
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
    
    return this.displayDigitCount;
  }

  /**
   * Генерирует цифры для каждого разряда
   * ИСПРАВЛЕННАЯ ЛОГИКА:
   * 1. Генерируем доступные действия БЕЗ фильтрации по знаку
   * 2. Проверяем, можно ли применить с обоими знаками
   * 3. Выбираем тот знак, который работает
   * 4. Чередуем знаки между шагами
   * 
   * @param {Array<number>} states - текущие состояния
   * @param {number} digitCount - сколько разрядов использовать
   * @param {boolean} isFirst - первый шаг?
   * @param {Array} previousSteps - история шагов
   * @returns {Object|null}
   */
  _generateDigits(states, digitCount, isFirst, previousSteps) {
    // Массив для цифр (включая старший разряд переноса)
    const digits = Array(this.maxDigitCount).fill(0);
    const usedDigits = new Set();
    let hasNonZero = false;
    
    // Определяем ЖЕЛАЕМЫЙ знак (чередуем с предыдущим)
    let desiredSign = 1;
    if (!isFirst && previousSteps.length > 0) {
      const lastStep = previousSteps[previousSteps.length - 1];
      if (lastStep && lastStep.action) {
        const lastSign = Math.sign(lastStep.action);
        desiredSign = -lastSign; // Чередуем
      }
    }
    
    console.log(`  🎲 Генерация ${digitCount}-значного числа, желаемый знак: ${desiredSign > 0 ? '+' : '-'}`);
    
    // Позволяем ли дубликаты в этом числе?
    const allowDuplicates = Math.random() < this.config.duplicateDigitProbability
      && this.config._duplicatesUsed < 1;
    
    // Собираем кандидатов для каждого разряда
    const candidates = []; // [{pos, absValue, canPlus, canMinus}, ...]
    
    // Проходим по разрядам от старшего к младшему
    for (let pos = this.displayDigitCount - 1; pos >= 0; pos--) {
      const currentState = states[pos];
      const isFirstForDigit = isFirst && pos === this.displayDigitCount - 1;
      
      let availableActions = this.baseRule.getAvailableActions(
        currentState,
        isFirstForDigit,
        previousSteps
      );
      
      if (!availableActions || availableActions.length === 0) {
        console.log(`  ⚠️ Разряд ${pos}: нет доступных действий из состояния ${currentState}`);
        continue;
      }
      
      // Извлекаем абсолютные значения БЕЗ фильтрации по usedDigits!
      // Фильтрацию применим позже при выборе
      const absActions = [];
      for (const action of availableActions) {
        const value = this._getActionValue(action);
        const absValue = Math.abs(value);
        if (absValue > 0) {
          absActions.push(absValue);
        }
      }
      
      if (absActions.length === 0) continue;
      
      // Для каждой цифры проверяем, можно ли её применить с + и/или -
      for (const absValue of absActions) {
        const canPlus = (currentState + absValue) <= 9;
        const canMinus = (currentState - absValue) >= 0;
        
        if (canPlus || canMinus) {
          candidates.push({ pos, absValue, canPlus, canMinus });
        }
      }
    }
    
    if (candidates.length === 0) {
      console.log(`  ❌ Нет доступных кандидатов для генерации`);
      return null;
    }
    
    // Определяем финальный знак
    // Проверяем, можем ли мы использовать желаемый знак
    const canUseDesiredSign = candidates.some(c => 
      (desiredSign > 0 && c.canPlus) || (desiredSign < 0 && c.canMinus)
    );
    
    const finalSign = canUseDesiredSign ? desiredSign : -desiredSign;
    
    console.log(`  ✓ Финальный знак: ${finalSign > 0 ? '+' : '-'} (желаемый: ${desiredSign > 0 ? '+' : '-'}, возможен: ${canUseDesiredSign})`);
    
    // Выбираем цифры, которые работают с финальным знаком
    const validCandidates = candidates.filter(c =>
      (finalSign > 0 && c.canPlus) || (finalSign < 0 && c.canMinus)
    );
    
    if (validCandidates.length === 0) {
      console.log(`  ❌ Нет кандидатов для знака ${finalSign > 0 ? '+' : '-'}`);
      return null;
    }
    
    // Группируем по позициям
    const byPosition = {};
    for (const c of validCandidates) {
      if (!byPosition[c.pos]) byPosition[c.pos] = [];
      byPosition[c.pos].push(c.absValue);
    }
    
    // Выбираем по одной цифре для каждой позиции
    for (const posStr in byPosition) {
      const pos = parseInt(posStr);
      const values = byPosition[pos];
      
      // Фильтруем по уникальности (если нужно)
      let availableValues = values;
      if (!allowDuplicates) {
        availableValues = values.filter(v => !usedDigits.has(v));
      }
      
      // Если нет уникальных - используем любые
      if (availableValues.length === 0) {
        availableValues = values;
      }
      
      // Выбираем случайную цифру
      const absValue = this._chooseRandom(availableValues);
      
      digits[pos] = finalSign * absValue;
      usedDigits.add(absValue);
      hasNonZero = true;
      
      const newState = states[pos] + digits[pos];
      console.log(`  ✓ Разряд ${pos}: ${states[pos]} ${finalSign > 0 ? '+' : ''}${digits[pos]} → ${newState}`);
      
      // Отмечаем дубликат если есть
      if (allowDuplicates && Array.from(usedDigits).filter(d => d === absValue).length > 1) {
        this.config._duplicatesUsed++;
      }
    }
    
    // Должно быть хотя бы одно ненулевое значение
    if (!hasNonZero) {
      console.log(`  ❌ Не удалось сгенерировать ни одной цифры`);
      return null;
    }
    
    // Считаем итоговое значение числа
    let value = 0;
    for (let pos = 0; pos < this.displayDigitCount; pos++) {
      value += Math.abs(digits[pos]) * Math.pow(10, pos);
    }
    
    console.log(`  ✓ Сгенерировано число: ${finalSign > 0 ? '+' : ''}${value}`);
    
    return {
      value,
      sign: finalSign,
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
    
    // 2. Проверяем количество нулевых разрядов (смягчаем - разрешаем больше)
    const zeroCount = digits.filter(d => d === 0).length;
    if (zeroCount > 0 && zeroCount >= this.displayDigitCount - 1) {
      // Слишком много нулей (например +00 в двузначном)
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
   * @param {Array<number>} state - массив разрядов [3, 2, 1, 0] (младший первый + разряд переноса)
   * @returns {number} - число 123 (без учёта разряда переноса)
   */
  stateToNumber(state) {
    if (!Array.isArray(state)) return 0;
    
    // Считаем только displayDigitCount разрядов (без старшего разряда переноса)
    let result = 0;
    for (let i = 0; i < this.displayDigitCount && i < state.length; i++) {
      result += state[i] * Math.pow(10, i);
    }
    
    return result;
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
