// ext/core/ExampleGenerator.js - Генератор примеров на основе правил

export class ExampleGenerator {
  constructor(rule) {
    this.rule = rule;
    console.log(`⚙️ Генератор создан с правилом: ${rule.name}`);
  }

  /**
   * Сгенерировать один пример.
   *  - если digitCount === 1 → одноразрядная логика (_generateSingleDigitAttempt)
   *  - если digitCount > 1   → векторная логика (_generateMultiDigitAttemptVectorBased)
   */
  generate() {
    const digitCount = this.rule.config?.digitCount || 1;
    const combineLevels = this.rule.config?.combineLevels || false;

    // Сколько попыток даём генератору, чтобы подобрать валидную цепочку
    let maxAttempts = digitCount === 1 ? 100 : (digitCount <= 3 ? 200 : 250);

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
          example = this._generateSingleDigitAttempt();
        } else {
          example = this._generateMultiDigitAttemptVectorBased();
        }

        // Если получили цепочку длиннее лимита maxSteps — обрежем и пересчитаем ответ
        const maxStepsAllowed =
          this.rule.config?.maxSteps ?? example.steps.length;

        if (example.steps.length > maxStepsAllowed) {
          console.warn(
            `⚠️ Генератор создал ${example.steps.length} шагов при лимите ${maxStepsAllowed}, обрезаем`
          );

          const trimmedSteps = example.steps.slice(0, maxStepsAllowed);

          // Пересчёт ответа
          let recomputedState = example.start;
          for (const step of trimmedSteps) {
            recomputedState = this.rule.applyAction(
              recomputedState,
              step.action
            );
          }

          example = {
            start: example.start,
            steps: trimmedSteps,
            answer: recomputedState
          };
        }

        // Проверка, что промежуточные состояния не вылезли за 0..9 (актуально для нескольких разрядов)
        if (digitCount > 1 && !combineLevels) {
          if (!this._validateIntermediateStates(example)) {
            console.warn(
              `⚠️ Попытка ${attempt}: промежуточные состояния вышли за диапазон`
            );
            continue;
          }
        }

        // Финальная валидация методикой
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
   * Генерация ОДНОГО РАЗРЯДА (самый частый кейс "Просто").
   *
   * Алгоритм:
   *  1. стартуем с 0;
   *  2. на каждом шаге спрашиваем у правила getAvailableActions(currentState, isFirstStep);
   *  3. выбираем одно из допустимых действий;
   *     - лёгкий приоритет больших абсолютных значений шага,
   *       чтобы цифры 6-9 чаще попадали, если они разрешены;
   *  4. применяем шаг;
   *  5. повторяем.
   *
   * Никаких искусственных "запрет одинакового шага подряд".
   * Никаких попыток "починить" финал — это делает validateExample.
   */
  _generateSingleDigitAttempt() {
    // стартовое состояние (обычно 0)
    const start = this.rule.generateStartState();
    let stepsCount = this.rule.generateStepsCount();

    // гарантируем минимум шагов
    const minSteps = this.rule.config?.minSteps ?? 2;
    if (stepsCount < minSteps) stepsCount = minSteps;

    const steps = [];
    let currentState = start;

    for (let i = 0; i < stepsCount; i++) {
      const isFirstAction = i === 0 && steps.length === 0;

      // доступные ходы физически возможные сейчас
      let availableActions = this.rule.getAvailableActions(
        currentState,
        isFirstAction
      );

      if (!availableActions || availableActions.length === 0) {
        // мы упёрлись (например стояли на 4, а все разрешённые цифры — только плюсы)
        // просто заканчиваем пример раньше
        break;
      }

      // bias: хотим немного чаще выбирать большие цифры,
      // чтобы 6,7,8,9 реально встречались.
      // сделаем из availableActions "мешок" с весами по |delta|.
      const weighted = [];
      for (const act of availableActions) {
        const w = 1 + Math.abs(act) * 0.3; // чуть больше вес у больших
        for (let k = 0; k < w; k++) {
          weighted.push(act);
        }
      }

      const action =
        weighted[Math.floor(Math.random() * weighted.length)];

      // применяем действие
      const newState = this.rule.applyAction(currentState, action);

      steps.push({
        action,
        fromState: currentState,
        toState: newState
      });

      currentState = newState;
    }

    return {
      start,
      steps,
      answer: currentState
    };
  }

  /**
   * Генерация МНОГОРАЗРЯДНОГО примера (digitCount > 1).
   * Каждый шаг — это вектор {position,value} для КАЖДОГО разряда,
   * причём знак у всех разрядов на шаге общий (+ или -).
   * Первый шаг обязан быть положительным.
   */
  _generateMultiDigitAttemptVectorBased() {
    const digitCount = this.rule.config?.digitCount || 2;
    const maxSteps = this.rule.generateStepsCount();
    const firstMustBePositive =
      this.rule.config?.firstActionMustBePositive !== false;

    // начальное состояние: [0,0,...]
    let currentState = this.rule.generateStartState();
    const startState = Array.isArray(currentState)
      ? [...currentState]
      : [currentState];

    const steps = [];

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      const isFirstStep = stepIndex === 0 && steps.length === 0;

      // какой знак разрешён?
      const candidateSigns =
        isFirstStep && firstMustBePositive ? [+1] : [+1, -1];

      let chosenVector = null;

      // пробуем построить валидный общий вектор для одного из разрешённых знаков
      for (const sign of candidateSigns) {
        const vectors = this._buildCandidateVectorsForSign(
          currentState,
          sign,
          isFirstStep
        );

        if (vectors.length === 0) {
          continue;
        }

        // выберем случайный вектор
        chosenVector =
          vectors[Math.floor(Math.random() * vectors.length)];
        break;
      }

      // если вообще не нашли ход — выходим
      if (!chosenVector) {
        break;
      }

      // применяем вектор сразу ко всем разрядам
      const newState = this._applyVectorToAllDigits(
        currentState,
        chosenVector
      );

      steps.push({
        action: chosenVector, // [{position,value},...]
        fromState: currentState,
        toState: newState
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
   * Строим ВСЕ возможные векторы действий для заданного знака шага (+ или -)
   * так, чтобы каждый разряд получил допустимый локальный шаг,
   * и чтобы после шага не было выхода за 0..9.
   */
  _buildCandidateVectorsForSign(currentState, sign, isFirstStep) {
    const digitCount = this.rule.config?.digitCount || 2;

    const perDigitOptions = [];

    for (let pos = 0; pos < digitCount; pos++) {
      const localActions = this.rule.getAvailableActions(
        currentState,
        isFirstStep,
        pos
      );

      // отфильтровать по знаку
      const filtered = localActions.filter(a => {
        const v = typeof a === "object" ? a.value : a;
        return sign > 0 ? v > 0 : v < 0;
      });

      if (filtered.length === 0) {
        // один из разрядов не может двигаться с таким знаком -> вектор невозможен
        return [];
      }

      // нормализуем к формату {position,value}
      const normalized = filtered.map(a =>
        typeof a === "object" ? a : { position: pos, value: a }
      );

      perDigitOptions.push(normalized);
    }

    // декартово произведение всех разрядов
    const allCombos = this._cartesian(perDigitOptions);

    // фильтруем те комбинации, которые выбивают хоть один разряд за 0..9
    const validCombos = allCombos.filter(vector => {
      const newState = this._applyVectorToAllDigits(
        currentState,
        vector
      );
      if (newState.some(d => d < 0)) return false;
      if (newState.some(d => d > 9)) return false;
      return true;
    });

    return validCombos;
  }

  /**
   * Применяет вектор [{position,value}, ...] к состоянию массива разрядов.
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
   * Декартово произведение массивов вариантов для каждого разряда.
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
   * Проверка промежуточных состояний в многозначном режиме:
   * нельзя уходить <0 или >9 ни в одном разряде.
   */
  _validateIntermediateStates(example) {
    const digitCount = this.rule.config?.digitCount || 1;
    if (digitCount === 1) return true;

    for (let i = 0; i < example.steps.length; i++) {
      const stateArr = example.steps[i].toState;
      if (Array.isArray(stateArr)) {
        if (stateArr.some(d => d < 0 || d > 9)) {
          console.warn(
            `❌ Шаг ${i + 1}: состояние [${stateArr.join(
              ", "
            )}] содержит недопустимое значение`
          );
          return false;
        }
      }
    }

    const finalArr = example.answer;
    if (Array.isArray(finalArr)) {
      if (finalArr.some(d => d < 0 || d > 9)) {
        console.warn(
          `❌ Финал содержит недопустимую цифру [${finalArr.join(
            ", "
          )}]`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Формат для отладки в консоли.
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
   * Формат для trainer_logic.js:
   *  - steps => массив строк вида "+3", "-7", "+5"
   *  - answer => конечное число
   *
   * В многозначном режиме мы склеиваем вектор действий в строку типа "+32".
   */
  toTrainerFormat(example) {
    const digitCount = this.rule.config?.digitCount || 1;

    // многозначный кейс
    if (digitCount > 1 && Array.isArray(example.start)) {
      const formattedSteps = [];

      for (const step of example.steps) {
        const vector = Array.isArray(step.action)
          ? step.action
          : [step.action];

        // соберём значения по позициям
        const byPos = [];
        for (const part of vector) {
          byPos[part.position] = part.value;
        }

        // знак шага (предполагаем единый знак векторного шага)
        const signValue = byPos.find(v => v !== 0) || 0;
        const signStr = signValue >= 0 ? "+" : "-";

        // абсолютные значения от старшего к младшему
        const maxPos = byPos.length - 1;
        let magnitudeStr = "";
        for (let p = maxPos; p >= 0; p--) {
          const v = byPos[p] || 0;
          magnitudeStr += Math.abs(v).toString();
        }

        formattedSteps.push(`${signStr}${magnitudeStr}`);
      }

      const finalAnswer = this.rule.stateToNumber(example.answer);

      return {
        start: this.rule.stateToNumber(example.start),
        steps: formattedSteps,
        answer: finalAnswer
      };
    }

    // одноразрядный кейс
    return {
      start: this.rule.stateToNumber(example.start),
      steps: example.steps.map(step =>
        this.rule.formatAction(step.action)
      ),
      answer: this.rule.stateToNumber(example.answer)
    };
  }

  /**
   * Делегируем правилам финальную валидацию.
   */
  validate(example) {
    if (this.rule.validateExample) {
      return this.rule.validateExample(example);
    }
    return true;
  }

  /**
   * Сгенерировать несколько примеров подряд.
   */
  generateMultiple(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(this.generate());
    }
    return out;
  }
}
