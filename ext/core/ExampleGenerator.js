// ext/core/ExampleGenerator.js - Генератор примеров на основе правил

export class ExampleGenerator {
  constructor(rule) {
    this.rule = rule;
    console.log(`⚙️ Генератор создан с правилом: ${rule.name}`);
  }

  /**
   * Сгенерировать один пример с учётом количества разрядов.
   * Для 1 разряда используем старую пошаговую логику (_generateAttempt).
   * Для 2+ разрядов — новый векторный генератор, где каждый шаг это одновременное действие по всем разрядам.
   */
  generate() {
    const digitCount = this.rule.config?.digitCount || 1;
    const combineLevels = this.rule.config?.combineLevels || false;

    // попыток генерации примера (поднимем для многозначных)
    let maxAttempts =
      digitCount === 1 ? 100 : (digitCount <= 3 ? 200 : 250);

    // combineLevels=false без переноса — сложнее, даём больше шансов
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
          // старая проверенная логика для одного разряда
          example = this._generateAttempt();
        } else {
          // новая логика для многозначных чисел — векторные шаги
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

          // пересчитать финальное состояние answer из start, применив только оставшиеся шаги
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

        // Дополнительная проверка промежуточных состояний
        if (digitCount > 1 && !combineLevels) {
          if (!this._validateIntermediateStates(example)) {
            console.warn(
              `⚠️ Попытка ${attempt}: промежуточные состояния вышли за диапазон`
            );
            continue;
          }
        }

        // Валидация примера правилом
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
   * Идея:
   * - Мы считаем текущее состояние всего абакуса как массив [единицы, десятки, сотни, ...].
   * - Каждый шаг = вектор действий по всем разрядам одновременно.
   * - Все разряды в этом шаге идут с одним знаком (все + или все -), чтобы шаг можно было "сыграть" одним жестом.
   * - Мы не допускаем уход ниже 0 в любом разряде.
   * - Мы не делаем перенос между разрядами: разряд не может стать >9.
   * - Ответ в конце может быть любым >=0 (ограничение диапазона сверху уже снято в UnifiedSimpleRule).
   */
  _generateMultiDigitAttemptVectorBased() {
    const digitCount = this.rule.config?.digitCount || 2;
    const maxSteps = this.rule.generateStepsCount(); // целевая длина
    const firstMustBePositive = this.rule.config?.firstActionMustBePositive !== false;

    // стейт вида [0,0,0...] длиной digitCount
    let currentState = this.rule.generateStartState(); // ожидаем [0,...]
    const startState = Array.isArray(currentState)
      ? [...currentState]
      : [currentState];

    const steps = [];

    // Генерируем шаги один за другим
    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      const isFirstStep = (stepIndex === 0 && steps.length === 0);

      // 1. Определяем знак этого шага (+ или -)
      // первое действие обязательно +
      // дальше знак можно выбирать случайно (но только если реально существуют такие действия)
      let desiredSign;
      if (isFirstStep && firstMustBePositive) {
        desiredSign = +1;
      } else {
        // пробуем оба направления, но рандомим приоритет
        desiredSign = Math.random() < 0.5 ? +1 : -1;
      }

      // функция, которая возвращает массив доступных "векторов шагов" для данного знака
      const candidateVectorsForSign = (sign) =>
        this._buildCandidateVectorsForSign(currentState, sign);

      // пробуем сначала желаемый знак
      let candidateVectors = candidateVectorsForSign(desiredSign);

      // если ничего не нашли, пробуем другой знак
      if (candidateVectors.length === 0 && !isFirstStep) {
        candidateVectors = candidateVectorsForSign(desiredSign * -1);
      }

      // если всё ещё пусто — мы не можем продолжать цепочку, останавливаемся раньше
      if (candidateVectors.length === 0) {
        break;
      }

      // выберем случайно один вектор
      const chosenVector = candidateVectors[
        Math.floor(Math.random() * candidateVectors.length)
      ];

      // применяем этот вектор к состоянию разрядов
      const newState = this._applyVectorToAllDigits(currentState, chosenVector);

      steps.push({
        action: chosenVector,     // вектор [{position, value}, ...]
        fromState: currentState,  // массив до шага
        toState: newState         // массив после шага
      });

      currentState = newState;
    }

    // Финальное состояние — это answer
    return {
      start: startState,
      steps,
      answer: currentState
    };
  }

  /**
   * Строит ВСЕ допустимые векторы действий для одного шага,
   * где ВСЕ разряды идут в одном направлении (sign = +1 или sign = -1).
   *
   * Возвращает массив векторов.
   * Вектор = массив объектов { position, value }, один для каждого разряда.
   * Пример для 2 разрядов: [ {position:1, value:+3}, {position:0, value:+2} ]
   * Это потом станет шагом "+32".
   */
  _buildCandidateVectorsForSign(currentState, sign) {
    const digitCount = this.rule.config?.digitCount || 2;

    // Для каждого разряда генерируем допустимые локальные шаги
    // фильтруем их по знаку (все плюсы или все минусы)
    const perDigitOptions = [];

    for (let pos = 0; pos < digitCount; pos++) {
      const localActions = this.rule.getAvailableActions(
        currentState,
        false,       // isFirstAction - мы уже обработали отдельно в _generateMultiDigitAttemptVectorBased
        pos
      );

      // оставляем только шаги нужного знака (все + или все -)
      const filtered = localActions.filter(a => {
        const v = (typeof a === "object") ? a.value : a;
        return (sign > 0 ? v > 0 : v < 0);
      }).map(a => (typeof a === "object" ? a : { position: pos, value: a }));

      // если для какого-то разряда нет шагов с нужным знаком — этот знак не подходит
      if (filtered.length === 0) {
        return []; // весь вектор не может быть построен в этом направлении
      }

      perDigitOptions.push(filtered);
    }

    // Теперь надо скомбинировать по одному действию на каждый разряд,
    // чтобы получить полный вектор "сразу для всех разрядов"
    // Например:
    //  десятки: [+3, +1]
    //  единицы: [+2, +4]
    // Комбинации:
    //  [ {+3 десятки}, {+2 единицы} ]
    //  [ {+3 десятки}, {+4 единицы} ]
    //  [ {+1 десятки}, {+2 единицы} ]
    //  [ {+1 десятки}, {+4 единицы} ]

    const allCombos = this._cartesian(perDigitOptions);

    // отфильтруем только те комбинации, которые физически выполнимы сразу
    // (ни один разряд не уходит <0 или >9 после применения)
    const validCombos = allCombos.filter(vector => {
      const newState = this._applyVectorToAllDigits(currentState, vector);

      // Запрещаем отрицательные значения в любом разряде
      if (newState.some(d => d < 0)) return false;

      // Запрещаем значения >9 в любом разряде (никаких переносов сейчас)
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
   * СТАРЫЙ генератор одной попытки (используется только когда digitCount === 1).
   * Оставляем как есть для одноразрядных чисел.
   */
  _generateAttempt() {
    const start = this.rule.generateStartState();
    let stepsCount = this.rule.generateStepsCount();

    const startStr = Array.isArray(start) ? `[${start.join(', ')}]` : start;
    console.log(`🎲 Генерация примера: старт=${startStr}, шагов=${stepsCount}`);

    const steps = [];
    let currentState = start;
    let has5Action = false;
    let blockInserted = false;

    const requireBlock = this.rule.config?.requireBlock;
    const blockPlacement = this.rule.config?.blockPlacement || "auto";

    // Блок в начало
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

    // Основные шаги (однозначный режим)
    for (let i = 0; i < stepsCount; i++) {
      const isFirstAction = (i === 0 && steps.length === 0);
      const isLastAction = (i === stepsCount - 1);

      let availableActions = this.rule.getAvailableActions(
        currentState,
        isFirstAction
      );

      if (availableActions.length === 0) {
        throw new Error(
          `Нет доступных действий из состояния ${currentState}`
        );
      }

      // приоритет пятёрки после части примера
      const hasFive = this.rule.config?.hasFive;
      if (hasFive && !has5Action && i >= Math.floor(stepsCount / 3)) {
        const actions5 = availableActions.filter(a => Math.abs(a) === 5);
        if (actions5.length > 0 && Math.random() < 0.4) {
          availableActions = actions5;
        }
      }

      // не даём вернуться в 0 последним шагом
      if (isLastAction && typeof currentState === "number" && currentState <= 4) {
        const nonZeroActions = availableActions.filter(action => {
          const result = currentState + action;
          return result !== 0;
        });
        if (nonZeroActions.length > 0) {
          availableActions = nonZeroActions;
        }
      }

      // выбираем действие
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

    // Блок в конец, если обязателен
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

    // Если финальное состояние превысило maxFinalState (например 7 при "Просто 5"), дожимаем назад
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
   * Проверка промежуточных состояний для старой логики (combineLevels=false).
   * Для новой векторной многозначной логики мы уже гарантируем валидность разрядов
   * (не <0 и не >9), так что это — защитный fallback.
   */
  _validateIntermediateStates(example) {
    const digitCount = this.rule.config?.digitCount || 1;
    if (digitCount === 1) return true;

    // Мы больше не требуем верхнюю границу финального диапазона.
    // Но мы не хотим уходить в отрицательное по ходу шага.
    for (let i = 0; i < example.steps.length; i++) {
      const stateArr = example.steps[i].toState;
      if (Array.isArray(stateArr)) {
        // никакой цифры <0 и >9
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
   * Форматируем пример в строку для отладки (не используется тренажёром напрямую).
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
   * Теперь:
   *  - если 1 разряд: как раньше
   *  - если много разрядов: каждый шаг это вектор -> "+32", "-14", "+505", ...
   */
  toTrainerFormat(example) {
    const digitCount = this.rule.config?.digitCount || 1;

    // многозначный случай
    if (digitCount > 1 && Array.isArray(example.start)) {
      const formattedSteps = [];

      for (const step of example.steps) {
        // step.action — это вектор [{position,value}, ...]
        // нам надо склеить абсолютные величины по всем разрядам
        // и один общий знак
        const vector = Array.isArray(step.action)
          ? step.action
          : [step.action];

        // Собираем по позициям
        // позиция 0 = единицы, 1 = десятки ... Нужно вывести старший разряд слева.
        const byPos = [];
        for (const part of vector) {
          byPos[part.position] = part.value;
        }

        // Вычисляем знак шага (все значения одного знака по определению генератора)
        const signValue = byPos.find(v => v !== 0) || 0;
        const signStr = signValue >= 0 ? "+" : "-";

        // Берём абсолютные значения по всем позициям и склеиваем как число
        // пример: десятки +3, единицы +2 => "32"
        // если какой-то разряд не менялся на этом шаге, то это считается 0 в нём
        const maxPos = byPos.length - 1;
        let magnitudeStr = "";
        for (let p = maxPos; p >= 0; p--) {
          const v = byPos[p] || 0;
          magnitudeStr += Math.abs(v).toString();
        }

        formattedSteps.push(`${signStr}${magnitudeStr}`);
      }

      // ответ = текущее состояние массив разрядов -> число
      const finalAnswer = this.rule.stateToNumber(example.answer);

      return {
        start: this.rule.stateToNumber(example.start),
        steps: formattedSteps,
        answer: finalAnswer
      };
    }

    // однозначный случай
    return {
      start: this.rule.stateToNumber(example.start),
      steps: example.steps.map(step =>
        this.rule.formatAction(step.action)
      ),
      answer: this.rule.stateToNumber(example.answer)
    };
  }

  /**
   * Валидация примера при необходимости (теперь верхний предел для многозначных не жмём).
   */
  validate(example) {
    if (this.rule.validateExample) {
      return this.rule.validateExample(example);
    }
    return true;
  }

  /**
   * Сгенерировать несколько примеров
   */
  generateMultiple(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(this.generate());
    }
    return out;
  }
}
