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

  console.log(`🎲 Генерация примера: старт=${start}, шагов=${stepsCount}`);

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
    let availableActions = this.rule.getAvailableActions(currentState, isFirstAction);

    if (availableActions.length === 0) {
      throw new Error(`Нет доступных действий из состояния ${currentState}`);
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
      const actions5 = availableActions.filter(a => Math.abs(a) === 5);
      if (actions5.length > 0 && Math.random() < 0.4) { // 40% шанс вместо 80%
        availableActions = actions5;
      }
    }

    // ✅ На последнем шаге избегаем действий, ведущих к 0 (если можно)
    if (isLastAction && currentState <= 4) {
      const nonZeroActions = availableActions.filter(action => {
        const result = currentState + action;
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
    if (Math.abs(action) === 5) {
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
  if (this.rule.config?.maxFinalState !== undefined && currentState > this.rule.config.maxFinalState) {
    currentState = this._repairToRange(steps, currentState);
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
   * @param {number} currentState - Текущее состояние
   * @returns {number} - Скорректированное состояние
   * @private
   */
  _repairToRange(steps, currentState) {
    const maxFinal = this.rule.config.maxFinalState;

    console.log(`🔧 Repair to range: ${currentState} → 0..${maxFinal}`);

    let attempts = 0;
    const maxAttempts = 10;

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
    
    // Если старт = 0, не показываем его
    if (start === 0) {
      return `${stepsStr} = ${answer}`;
    } else {
      return `${start} ${stepsStr} = ${answer}`;
    }
  }

  /**
   * Конвертирует пример в формат для trainer_logic.js
   * @param {Object} example - Пример {start, steps, answer}
   * @returns {Object} - Пример в формате {start, steps: string[], answer}
   */
  toTrainerFormat(example) {
    return {
      start: example.start,
      steps: example.steps.map(step => this.rule.formatAction(step.action)),
      answer: example.answer
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
