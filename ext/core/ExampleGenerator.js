// ext/core/ExampleGenerator.js - Генератор примеров на основе правил

export class ExampleGenerator {
  constructor(rule) {
    this.rule = rule;
    console.log(`⚙️ Генератор создан с правилом: ${rule.name}`);
  }

  /**
   * Сгенерировать один пример с учётом количества разрядов.
   * Для 1 разряда используем пошаговую логику (_generateAttempt).
   * Для 2+ разрядов — векторный генератор, где каждый шаг это одновременное действие по всем разрядам.
   */
  generate() {
    const digitCount = this.rule.config?.digitCount || 1;
    const combineLevels = this.rule.config?.combineLevels || false;

    // Кол-во попыток подобрать валидный пример
    let maxAttempts = digitCount === 1 ? 100 : (digitCount <= 3 ? 200 : 250);

    // Если много разрядов и без комбинирования уровней, увеличиваем запас
    if (!combineLevels && digitCount > 1) {
      maxAttempts *= 2;
    }

    console.log(
      `🎯 Генерация примера: digitCount=${digitCount}, combineLevels=${combineLevels}, попыток=${maxAttempts}`
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let example;

        if (digitCount === 1) {
          // Одноразрядный пример (последовательность +N / -N)
          example = this._generateAttempt();
        } else {
          // Многозначный пример (каждый шаг — общий жест по всем разрядам)
          example = this._generateMultiDigitAttemptVectorBased();
        }

        // 🔧 FIX бага с лишними шагами:
        // ограничиваем количество шагов до maxSteps и пересчитываем ответ
        const maxStepsAllowed = this.rule.config?.maxSteps ?? example.steps.length;
        if (example.steps.length > maxStepsAllowed) {
          console.warn(
            `⚠️ Генератор создал ${example.steps.length} шагов при лимите ${maxStepsAllowed}, обрезаем`
          );

          const trimmedSteps = example.steps.slice(0, maxStepsAllowed);

          // Пересчитываем финальную позицию после обрезки
          let recomputedState = example.start;
          for (const step of trimmedSteps) {
            recomputedState = this.rule.applyAction(recomputedState, step.action);
          }

          example = {
            start: example.start,
            steps: trimmedSteps,
            answer: recomputedState
          };
        }

        // Лёгкая валидация промежуточных состояний
        if (digitCount > 1 && !combineLevels) {
          if (!this._validateIntermediateStates(example)) {
            console.warn(
              `⚠️ Попытка ${attempt}: промежуточные состояния вышли за диапазон`
            );
            continue;
          }
        }

        // Валидация правилом
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

    throw new Error(
      `Не удалось сгенерировать валидный пример за ${maxAttempts} попыток`
    );
  }

  /**
   * НОВЫЙ ГЕНЕРАТОР для многозначных примеров (digitCount > 1).
   *
   * Логика (согласовано с методикой):
   * - Состояние — массив по разрядам: [единицы, десятки, сотни, ...] (в твоей системе).
   * - Каждый шаг = один общий жест по всем выбранным разрядам.
   *   То есть у десятков своё +N или -N, у единиц своё +M или -M,
   *   но знак шага ДОЛЖЕН быть общий (всё плюс или всё минус в этот такт).
   * - Эти дельты по каждому разряду мы больше НЕ синтезируем вручную,
   *   мы берём их из rule.getAvailableActions(...) — и там уже сидит физика абакуса.
   * - После применения шага никакой разряд не должен выйти за 0..9
   *   (никаких переносов).
   * - Первый шаг не может быть отрицательным.
   */
  _generateMultiDigitAttemptVectorBased() {
    const digitCount = this.rule.config?.digitCount || 2;
    const maxSteps = this.rule.generateStepsCount();
    const firstMustBePositive = this.rule.config?.firstActionMustBePositive !== false;

    // Начальное состояние типа [0,0,...]
    let currentState = this.rule.generateStartState();
    const startState = Array.isArray(currentState)
      ? [...currentState]
      : [currentState];

    const steps = [];

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      const isFirstStep = (stepIndex === 0 && steps.length === 0);

      // 1. Разрешённые знаки на этом шаге.
      //    - если это первый шаг и он должен быть положительным → только '+'
      //    - иначе можно попытаться '+' или '-'
      const candidateSigns = isFirstStep && firstMustBePositive
        ? [+1]
        : [+1, -1];

      let chosenVector = null;

      // Пытаемся построить валидный шаг для одного из разрешённых знаков
      for (const sign of candidateSigns) {
        const vectors = this._buildCandidateVectorsForSign(
          currentState,
          sign,
          isFirstStep
        );

        if (vectors.length === 0) {
          continue;
        }

        // Выбираем случайный вектор среди валидных
        chosenVector = vectors[Math.floor(Math.random() * vectors.length)];
        break;
      }

      // Не нашли ни одного возможного общего шага — на этом заканчиваем пример
      if (!chosenVector) {
        break;
      }

      // Применяем выбранный шаг ко всем разрядам
      const newState = this._applyVectorToAllDigits(currentState, chosenVector);

      steps.push({
        action: chosenVector,     // вектор [{position, value}, ...]
        fromState: currentState,  // состояние до шага
        toState: newState         // состояние после шага
      });

      currentState = newState;
    }

    return {
      start: startState,
      steps,
      answer: currentState
    };
  }

  /**
   * Построить ВСЕ допустимые векторы действий для одного общего шага,
   * где ВСЕ разряды двигаются с одним знаком (либо все +, либо все -).
   *
   * Важный момент:
   * - Мы НЕ придумываем возможные дельты сами.
   * - Мы спрашиваем rule.getAvailableActions(...) для КАЖДОГО разряда.
   *   После наших правок в UnifiedSimpleRule.getAvailableActions():
   *   - в многозначном режиме она возвращает массив объектов { position, value },
   *     где value уже готовая дельта (например +7, -3), валидная одним жестом.
   * - Мы фильтруем эти дельты по знаку (все плюсы или все минусы).
   * - Потом берём декартово произведение, чтобы получить все комбинации
   *   "каждому разряду по одному действию".
   * - Отбрасываем комбинации, которые приводят какой-то разряд <0 или >9.
   *
   * @param {number[]} currentState текущее состояние массива разрядов
   * @param {number} sign +1 или -1 (все плюсы или все минусы)
   * @param {boolean} isFirstStep нужно ли заставлять шаг быть положительным в каждом разряде
   * @returns {Array<Array<{position:number,value:number}>>>}
   */
  _buildCandidateVectorsForSign(currentState, sign, isFirstStep) {
    const digitCount = this.rule.config?.digitCount || 2;

    // Шаг 1. Собираем по каждому разряду список локальных допустимых действий
    // После нашей новой логики getAvailableActions в многозначном режиме
    // она уже возвращает [{ position, value }, ...]
    const perDigitOptions = [];

    for (let pos = 0; pos < digitCount; pos++) {
      // Здесь ВАЖНО: мы передаём isFirstAction только на самом первом шаге,
      // чтобы getAvailableActions применила правило "первое действие не может быть минусом"
      const localActions = this.rule.getAvailableActions(
        currentState,
        isFirstStep,
        pos
      );

      // Оставляем только те, что соответствуют нужному знаку
      // sign = +1 -> оставляем только value > 0
      // sign = -1 -> оставляем только value < 0
      const filtered = localActions.filter(a => {
        const v = (typeof a === "object") ? a.value : a;
        return sign > 0 ? v > 0 : v < 0;
      });

      // Если в каком-то разряде нет допустимого хода с этим знаком,
      // то мы не можем построить общий шаг с этим знаком вообще.
      if (filtered.length === 0) {
        return [];
      }

      // Убедимся, что элементы оформлены как {position,value}
      const normalized = filtered.map(a => {
        if (typeof a === "object") {
          return a;
        } else {
          return { position: pos, value: a };
        }
      });

      perDigitOptions.push(normalized);
    }

    // Шаг 2. Декартово перемножаем массивы,
    // чтобы получить все возможные комбинации "по одному действию на каждый разряд"
    const allCombos = this._cartesian(perDigitOptions);

    // Шаг 3. Фильтруем по физике:
    // - после применения вектора состояние всех разрядов остаётся в диапазоне [0..9]
    // - никаких переносов
    const validCombos = allCombos.filter(vector => {
      const newState = this._applyVectorToAllDigits(currentState, vector);

      // состояние по каждому разряду должно быть валидным: 0..9
      if (newState.some(d => d < 0)) return false;
      if (newState.some(d => d > 9)) return false;

      return true;
    });

    return validCombos;
  }

  /**
   * Применяет вектор [{position, value}, ...] к состоянию массива разрядов.
   * Возвращает новый массив состояния.
   */
  _applyVectorToAllDigits(stateArray, vector) {
    const result = [...stateArray];
    for (const part of vector) {
      const pos = part.position;
      const val = part.value;
      result[pos] = result[pos] + val;
    }
    return result;
  }

  /**
   * Декартово произведение массивов вариантов для каждого разряда,
   * чтобы получить все возможные комбинации "по одному действию на разряд".
   * input: [ [a,b], [c,d] ]
   * output: [ [a,c], [a,d], [b,c], [b,d] ]
   */
  _cartesian(arrays) {
    return arrays.reduce(
      (acc, curr) => {
        const res = [];
        for (const a of acc) {
          for (const b of curr) {
            res.push([...a, b]);
          }
        }
        return res;
      },
      [[]]
    );
  }

  /**
   * ГЕНЕРАЦИЯ ДЛЯ ОДНОГО РАЗРЯДА (digitCount === 1).
   * Здесь каждый шаг — одна дельта (+N или -N) из getAvailableActions().
   * После твоей правки UnifiedSimpleRule.getAvailableActions()
   * эти шаги уже учитывают физику абакуса и выбранные цифры (включая 6,7,8,9).
   */
  _generateAttempt() {
    const start = this.rule.generateStartState();
    let stepsCount = this.rule.generateStepsCount();

    const startStr = Array.isArray(start) ? `[${start.join(", ")}]` : start;
    console.log(`🎲 Генерация примера: старт=${startStr}, шагов=${stepsCount}`);

    const steps = [];
    let currentState = start;
    let has5Action = false;
    let blockInserted = false;

    const requireBlock = this.rule.config?.requireBlock;
    const blockPlacement = this.rule.config?.blockPlacement || "auto";

    // Блок в начало (если режим требует обязательный паттерн)
    if (requireBlock && blockPlacement === "start" && this.rule.generateBlock) {
      const block = this.rule.generateBlock(currentState, true);
      if (block) {
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

    // Основные шаги одноразрядного примера
    for (let i = 0; i < stepsCount; i++) {
      const isFirstAction = (i === 0 && steps.length === 0);
      const isLastAction = (i === stepsCount - 1);

      let availableActions = this.rule.getAvailableActions(
        currentState,
        isFirstAction
      );

      if (!availableActions || availableActions.length === 0) {
        throw new Error(
          `Нет доступных действий из состояния ${currentState}`
        );
      }

      // приоритет пятёрки примерно в середине примера
      const hasFive = this.rule.config?.hasFive;
      if (hasFive && !has5Action && i >= Math.floor(stepsCount / 3)) {
        const actions5 = availableActions.filter(a => Math.abs(a) === 5);
        if (actions5.length > 0 && Math.random() < 0.4) {
          availableActions = actions5;
        }
      }

      // Не даём последним шагом вернуться точь-в-точь в 0,
      // если текущее состояние ещё маленькое (методика удержать ребёнка в работе)
      if (isLastAction && typeof currentState === "number" && currentState <= 4) {
        const nonZeroActions = availableActions.filter(action => {
          const result = currentState + action;
          return result !== 0;
        });
        if (nonZeroActions.length > 0) {
          availableActions = nonZeroActions;
        }
      }

      // Выбираем действие случайно
      const action =
        availableActions[Math.floor(Math.random() * availableActions.length)];

      const newState = this.rule.applyAction(currentState, action);

      if (Math.abs(action) === 5) {
        has5Action = true;
      }

      steps.push({
        action,
        fromState: currentState,
        toState: newState
      });

      currentState = newState;
    }

    // Блок в конец (если требуется обязательная формула / корректировка)
    if (
      requireBlock &&
      !blockInserted &&
      this.rule.generateBlock &&
      this.rule.canInsertBlock
    ) {
      const canInsertPositive = this.rule.canInsertBlock(currentState, true);
      const canInsertNegative = this.rule.canInsertBlock(currentState, false);

      if (!canInsertPositive && !canInsertNegative) {
        throw new Error(`Не удалось вставить обязательный блок ±k`);
      }

      const isPositive = canInsertPositive ? true : false;
      const block = this.rule.generateBlock(currentState, isPositive);

      if (!block) {
        throw new Error(`Не удалось сгенерировать блок ±k`);
      }

      for (const action of block) {
        const newState = this.rule.applyAction(currentState, action);
        steps.push({
          action,
          fromState: currentState,
          toState: newState
        });
        currentState = newState;
        if (Math.abs(action) === 5) has5Action = true;
      }

      blockInserted = true;
    }

    // Если финал ушёл выше maxFinalState (например 7 при "Просто 5"),
    // пытаемся аккуратно опустить бусины в допустимый коридор
    if (
      this.rule.config?.maxFinalState !== undefined &&
      typeof currentState === "number" &&
      currentState > this.rule.config.maxFinalState
    ) {
      currentState = this._repairToRange(steps, currentState);
    }

    return {
      start: start,
      steps: steps,
      answer: currentState
    };
  }

  /**
   * Проверка промежуточных состояний в многозначном режиме.
   * Мы запрещаем любые состояния, где какой-то разряд <0 или >9.
   */
  _validateIntermediateStates(example) {
    const digitCount = this.rule.config?.digitCount || 1;
    if (digitCount === 1) return true;

    for (let i = 0; i < example.steps.length; i++) {
      const stateArr = example.steps[i].toState;
      if (Array.isArray(stateArr)) {
        if (stateArr.some(d => d < 0 || d > 9)) {
          console.warn(
            `❌ Шаг ${i + 1}: состояние [${stateArr.join(", ")}] содержит недопустимое значение`
          );
          return false;
        }
      }
    }

    const finalArr = example.answer;
    if (Array.isArray(finalArr)) {
      if (finalArr.some(d => d < 0 || d > 9)) {
        console.warn(
          `❌ Финал содержит недопустимую цифру [${finalArr.join(", ")}]`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Возврат к допустимому диапазону для одноразрядных (Просто 4 / Просто 5).
   * Если финал > допустимого методического коридора, пытаемся осадить бусины назад.
   */
  _repairToRange(steps, currentState) {
    const maxFinal = this.rule.config.maxFinalState;
    console.log(`🔧 Repair to range: ${currentState} → 0..${maxFinal}`);

    let attempts = 0;
    const maxAttempts = 10;

    if (typeof currentState === "number") {
      while (currentState > maxFinal && attempts < maxAttempts) {
        const isUpperActive = currentState >= 5;
        const activeLower = isUpperActive ? currentState - 5 : currentState;

        let action;

        if (isUpperActive && currentState - 5 <= maxFinal && currentState - 5 >= 0) {
          action = -5;
        } else if (activeLower > 0) {
          const needed = Math.min(activeLower, currentState - maxFinal);
          action = -needed;
        } else {
          console.warn(
            `⚠️ Не удалось скорректировать состояние ${currentState} до ${maxFinal}`
          );
          break;
        }

        const newState = this.rule.applyAction(currentState, action);
        steps.push({
          action,
          fromState: currentState,
          toState: newState
        });
        currentState = newState;
        attempts++;

        console.log(
          `  🔧 Шаг ${attempts}: ${this.rule.formatAction(action)} → ${currentState}`
        );
      }
    }

    return currentState;
  }

  /**
   * Форматируем пример в строку для отладки (чисто для логов).
   */
  formatForDisplay(example) {
    const { start, steps, answer } = example;

    const stepsStr = steps
      .map(step => this.rule.formatAction(step.action))
      .join(" ");

    const startNum = this.rule.stateToNumber(start);
    const answerNum = this.rule.stateToNumber(answer);

    if (startNum === 0) {
      return `${stepsStr} = ${answerNum}`;
    } else {
      return `${startNum} ${stepsStr} = ${answerNum}`;
    }
  }

  /**
   * Формат для trainer_logic.js
   *
   * - если 1 разряд:
   *      steps: ["+3", "-2", "+7", ...]
   *
   * - если много разрядов:
   *      каждый шаг это вектор {pos,value} по всем разрядам,
   *      и мы склеиваем его в формат "+32", "-17", "+805", ...
   *      где слева старший разряд, справа младший.
   */
  toTrainerFormat(example) {
    const digitCount = this.rule.config?.digitCount || 1;

    // многозначный случай
    if (digitCount > 1 && Array.isArray(example.start)) {
      const formattedSteps = [];

      for (const step of example.steps) {
        // step.action — это вектор [{position,value}, ...]
        const vector = Array.isArray(step.action)
          ? step.action
          : [step.action];

        // Собираем по позициям
        // position: 0 = единицы, 1 = десятки, ...
        const byPos = [];
        for (const part of vector) {
          byPos[part.position] = part.value;
        }

        // Определяем знак шага (мы гарантируем, что весь шаг одного знака)
        const signValue = byPos.find(v => v !== 0) || 0;
        const signStr = signValue >= 0 ? "+" : "-";

        // Строим строку разрядов от старшего к младшему
        const maxPos = byPos.length - 1;
        let magnitudeStr = "";
        for (let p = maxPos; p >= 0; p--) {
          const v = byPos[p] || 0;
          magnitudeStr += Math.abs(v).toString();
        }

        formattedSteps.push(`${signStr}${magnitudeStr}`);
      }

      // ответ (число) — преобразуем текущее состояние массива разрядов
      const finalAnswer = this.rule.stateToNumber(example.answer);

      return {
        start: this.rule.stateToNumber(example.start),
        steps: formattedSteps,
        answer: finalAnswer
      };
    }

    // одноразрядный случай
    return {
      start: this.rule.stateToNumber(example.start),
      steps: example.steps.map(step =>
        this.rule.formatAction(step.action)
      ),
      answer: this.rule.stateToNumber(example.answer)
    };
  }

  /**
   * Валидация примера при необходимости
   */
  validate(example) {
    if (this.rule.validateExample) {
      return this.rule.validateExample(example);
    }
    return true;
  }

  /**
   * Сгенерировать несколько примеров подряд
   */
  generateMultiple(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(this.generate());
    }
    return out;
  }
}
