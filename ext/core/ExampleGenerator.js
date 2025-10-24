// ext/core/ExampleGenerator.js - Генератор примеров на основе правил

/**
 * ExampleGenerator - класс для генерации примеров на основе заданного правила
 * Использует правила (BaseRule, SimpleRule, Simple5Rule и др.) для создания валидных примеров
 */
export class ExampleGenerator {
  constructor(rule) {
    this.rule = rule;
    console.log(`⚙️ Генератор создан с правилом: ${rule.name}`);
  }

  /**
   * Генерирует один пример
   * @returns {Object} - Пример в формате {start, steps, answer}
   */
  generate() {
    const maxAttempts = 100; // Максимум попыток генерации
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const example = this._generateAttempt();
        
        // Валидация примера
        if (this.rule.validateExample && !this.rule.validateExample(example)) {
          console.warn(`⚠️ Попытка ${attempt}: пример не прошёл валидацию`);
          continue;
        }
        
        console.log(`✅ Пример сгенерирован (попытка ${attempt})`);
        return example;
        
      } catch (error) {
        console.warn(`⚠️ Попытка ${attempt} неудачна:`, error.message);
      }
    }
    
    throw new Error(`Не удалось сгенерировать валидный пример за ${maxAttempts} попыток`);
  }

  /**
   * Одна попытка генерации примера
   * @private
   */
_generateAttempt() {
  const start = this.rule.generateStartState();
  let stepsCount = this.rule.generateStepsCount();

  const startStr = Array.isArray(start) ? `[${start.join(', ')}]` : start;
  console.log(`🎲 Генерация примера: старт=${startStr}, шагов=${stepsCount}`);

  const steps = [];
  let currentState = start;
  let has5Action = false; // Отслеживаем использование ±5
  let blockInserted = false; // Отслеживаем вставку блока ±k

  const requireBlock = this.rule.config?.requireBlock;
  const blockPlacement = this.rule.config?.blockPlacement || "auto";

  // === ВСТАВКА БЛОКА В НАЧАЛО ===
  if (requireBlock && blockPlacement === "start" && this.rule.generateBlock) {
    const block = this.rule.generateBlock(currentState, true);
    if (block) {
      console.log(`📦 Вставка блока в начало: [${block.join(', ')}]`);
      for (const action of block) {
        const newState = this.rule.applyAction(currentState, action);
        steps.push({ action, fromState: currentState, toState: newState });
        currentState = newState;
        if (Math.abs(action) === 5) has5Action = true;
      }
      blockInserted = true;
      stepsCount -= block.length;
    }
  }

  // === ГЕНЕРАЦИЯ ОСНОВНЫХ ШАГОВ ===
  for (let i = 0; i < stepsCount; i++) {
    const isFirstAction = (i === 0 && steps.length === 0);
    const isLastAction = (i === stepsCount - 1);

    let availableActions = [];

    // Для multi-digit режима генерируем действия для всех позиций
    const digitCount = this.rule.config?.digitCount || 1;
    if (digitCount > 1 && Array.isArray(currentState)) {
      // Собираем доступные действия для всех позиций
      for (let position = 0; position < digitCount; position++) {
        const actionsForPosition = this.rule.getAvailableActions(currentState, isFirstAction, position);
        availableActions = availableActions.concat(actionsForPosition);
      }

      // Стратегия: если без combineLevels и старший разряд = 0, повышаем приоритет действий на старший разряд
      const combineLevels = this.rule.config?.combineLevels || false;
      if (!combineLevels && i >= Math.floor(stepsCount / 2)) {
        const highestPosition = digitCount - 1;
        const highestDigitValue = currentState[highestPosition] || 0;

        // Если старший разряд всё ещё 0, приоритизируем действия на него
        if (highestDigitValue === 0) {
          const highPriorityActions = availableActions.filter(a =>
            typeof a === 'object' && a.position === highestPosition && a.value > 0
          );

          if (highPriorityActions.length > 0 && Math.random() < 0.7) {
            availableActions = highPriorityActions;
          }
        }
      }
    } else {
      // Legacy: однозначный режим
      availableActions = this.rule.getAvailableActions(currentState, isFirstAction);
    }

    if (availableActions.length === 0) {
      const stateStr = Array.isArray(currentState) ? `[${currentState.join(', ')}]` : currentState;
      throw new Error(`Нет доступных действий из состояния ${stateStr}`);
    }

    // === ПОПЫТКА ВСТАВИТЬ БЛОК В СЕРЕДИНЕ/КОНЦЕ ===
    if (requireBlock && !blockInserted && this.rule.generateBlock && this.rule.canInsertBlock) {
      const canInsertPositive = this.rule.canInsertBlock(currentState, true);
      const canInsertNegative = this.rule.canInsertBlock(currentState, false);

      // Вставляем блок с вероятностью 60% если возможно
      if ((canInsertPositive || canInsertNegative) && Math.random() < 0.6) {
        const isPositive = canInsertPositive ? true : false;
        const block = this.rule.generateBlock(currentState, isPositive);

        if (block) {
          console.log(`📦 Вставка блока в позиции ${steps.length}: [${block.join(', ')}]`);
          for (const action of block) {
            const newState = this.rule.applyAction(currentState, action);
            steps.push({ action, fromState: currentState, toState: newState });
            currentState = newState;
            if (Math.abs(action) === 5) has5Action = true;
          }
          blockInserted = true;
          stepsCount -= block.length; // ✅ Уменьшаем счетчик при вставке блока
          continue;
        }
      }
    }

    // ✅ Если есть 5 в выбранных цифрах и её ещё не было - повышаем шанс в середине
    const hasFive = this.rule.config?.hasFive;
    if (hasFive && !has5Action && i >= Math.floor(stepsCount / 3)) {
      const actions5 = availableActions.filter(a => {
        const value = typeof a === 'object' ? a.value : a;
        return Math.abs(value) === 5;
      });
      if (actions5.length > 0 && Math.random() < 0.4) { // 40% шанс вместо 80%
        availableActions = actions5;
      }
    }

    // ✅ На последнем шаге избегаем действий, ведущих к 0 (только для однозначных)
    if (isLastAction && typeof currentState === 'number' && currentState <= 4) {
      const nonZeroActions = availableActions.filter(action => {
        const value = typeof action === 'object' ? action.value : action;
        const result = currentState + value;
        return result !== 0;
      });
      if (nonZeroActions.length > 0) {
        availableActions = nonZeroActions;
      }
    }

    // Выбираем случайное действие
    const action = availableActions[Math.floor(Math.random() * availableActions.length)];
    const newState = this.rule.applyAction(currentState, action);

    // Отмечаем если использовали ±5
    const actionValue = typeof action === 'object' ? action.value : action;
    if (Math.abs(actionValue) === 5) {
      has5Action = true;
    }

    steps.push({
      action: action,
      fromState: currentState,
      toState: newState
    });

    currentState = newState;
  }

  // === ВСТАВКА БЛОКА В КОНЕЦ (если ещё не вставлен) ===
  if (requireBlock && !blockInserted && this.rule.generateBlock && this.rule.canInsertBlock) {
    const canInsertPositive = this.rule.canInsertBlock(currentState, true);
    const canInsertNegative = this.rule.canInsertBlock(currentState, false);

    if (!canInsertPositive && !canInsertNegative) {
      throw new Error(`Не удалось вставить обязательный блок ±k`);
    }

    const isPositive = canInsertPositive ? true : false;
    const block = this.rule.generateBlock(currentState, isPositive);

    if (block) {
      console.log(`📦 Вставка блока в конец: [${block.join(', ')}]`);
      for (const action of block) {
        const newState = this.rule.applyAction(currentState, action);
        steps.push({ action, fromState: currentState, toState: newState });
        currentState = newState;
        if (Math.abs(action) === 5) has5Action = true;
      }
      blockInserted = true;
      // ✅ Здесь не уменьшаем stepsCount, так как блок вставлен после цикла
    } else {
      throw new Error(`Не удалось сгенерировать блок ±k`);
    }
  }

  // === REPAIR TO RANGE (если финал выходит за пределы) ===
  if (this.rule.config?.maxFinalState !== undefined && typeof currentState === 'number' && currentState > this.rule.config.maxFinalState) {
    currentState = this._repairToRange(steps, currentState);
  }

  // === ПРОВЕРКА ДИАПАЗОНА ДЛЯ MULTI-DIGIT ===
  const digitCount = this.rule.config?.digitCount || 1;
  if (digitCount > 1 && Array.isArray(currentState)) {
    const finalNumber = this.rule.stateToNumber(currentState);
    const minFinal = this.rule.getMinFinalNumber();
    const maxFinal = this.rule.getMaxFinalNumber();

    if (finalNumber < minFinal || finalNumber > maxFinal) {
      throw new Error(`Финальное число ${finalNumber} вне диапазона ${minFinal}-${maxFinal}`);
    }
  }

  return {
    start: start,
    steps: steps,
    answer: currentState
  };
}

  /**
   * Корректирует финал до допустимого диапазона
   * @param {Array} steps - Массив шагов (изменяется)
   * @param {number|number[]} currentState - Текущее состояние
   * @returns {number|number[]} - Скорректированное состояние
   * @private
   */
  _repairToRange(steps, currentState) {
    const maxFinal = this.rule.config.maxFinalState;

    const stateStr = Array.isArray(currentState) ? `[${currentState.join(', ')}]` : currentState;
    console.log(`🔧 Repair to range: ${stateStr} → 0..${maxFinal}`);

    let attempts = 0;
    const maxAttempts = 10;

    // Legacy: работает только для однозначных чисел
    if (typeof currentState === 'number') {
      while (currentState > maxFinal && attempts < maxAttempts) {
        const isUpperActive = (currentState >= 5);
        const activeLower = isUpperActive ? currentState - 5 : currentState;

        let action;

        // Пытаемся -5, если верхняя активна и результат не ниже допустимого
        if (isUpperActive && (currentState - 5 <= maxFinal) && (currentState - 5 >= 0)) {
          action = -5;
        } else if (activeLower > 0) {
          // Иначе снимаем нижние (столько, сколько нужно, но не больше активных)
          const needed = Math.min(activeLower, currentState - maxFinal);
          action = -needed;
        } else {
          console.warn(`⚠️ Не удалось скорректировать состояние ${currentState} до ${maxFinal}`);
          break;
        }

        const newState = this.rule.applyAction(currentState, action);
        steps.push({ action, fromState: currentState, toState: newState });
        currentState = newState;
        attempts++;

        console.log(`  🔧 Шаг ${attempts}: ${this.rule.formatAction(action)} → ${currentState}`);
      }
    }
    // TODO: Для многозначных чисел repair не требуется в режиме "Просто"

    return currentState;
  }

  /**
   * Генерирует несколько примеров
   * @param {number} count - Количество примеров
   * @returns {Array} - Массив примеров
   */
  generateMultiple(count) {
    const examples = [];
    for (let i = 0; i < count; i++) {
      examples.push(this.generate());
    }
    return examples;
  }

  /**
   * Форматирует пример для отображения
   * @param {Object} example - Пример {start, steps, answer}
   * @returns {string} - Отформатированная строка
   */
  formatForDisplay(example) {
    const { start, steps, answer } = example;

    const stepsStr = steps
      .map(step => this.rule.formatAction(step.action))
      .join(' ');

    // Преобразуем start и answer в числа для отображения
    const startNum = this.rule.stateToNumber(start);
    const answerNum = this.rule.stateToNumber(answer);

    // Если старт = 0, не показываем его
    if (startNum === 0) {
      return `${stepsStr} = ${answerNum}`;
    } else {
      return `${startNum} ${stepsStr} = ${answerNum}`;
    }
  }

  /**
   * Конвертирует пример в формат для trainer_logic.js
   * @param {Object} example - Пример {start, steps, answer}
   * @returns {Object} - Пример в формате {start: number, steps: string[], answer: number}
   */
  toTrainerFormat(example) {
    return {
      start: this.rule.stateToNumber(example.start),  // Всегда преобразуем в число
      steps: example.steps.map(step => this.rule.formatAction(step.action)),
      answer: this.rule.stateToNumber(example.answer) // Всегда преобразуем в число
    };
  }

  /**
   * Валидирует пример
   * @param {Object} example - Пример для валидации
   * @returns {boolean}
   */
  validate(example) {
    if (this.rule.validateExample) {
      return this.rule.validateExample(example);
    }
    return true; // Если правило не предоставляет валидацию
  }
}
