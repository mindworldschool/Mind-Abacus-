// ext/core/ExampleGenerator.js - Генератор примеров на основе правил

export class ExampleGenerator {
  constructor(rule) {
    this.rule = rule;
    console.log(`⚙️ Генератор создан с правилом: ${rule.name}`);
  }

  /**
   * Сгенерировать один пример с учётом количества разрядов.
   * Для 1 разряда используем пошаговую логику (_generateSingleDigitAttempt).
   * Для 2+ разрядов — векторный генератор (_generateMultiDigitAttemptVectorBased),
   * где каждый шаг — одновременное действие по всем разрядам.
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
          example = this._generateSingleDigitAttempt();
        } else {
          // Многозначный пример (каждый шаг — общий жест по всем разрядам)
          example = this._generateMultiDigitAttemptVectorBased();
        }

        // 🔧 Если пример получился длиннее максимума —
        // обрежем и пересчитаем ответ
        const maxStepsAllowed =
          this.rule.config?.maxSteps ?? example.steps.length;
        if (example.steps.length > maxStepsAllowed) {
          console.warn(
            `⚠️ Генератор создал ${example.steps.length} шагов при лимите ${maxStepsAllowed}, обрезаем`
          );

          const trimmedSteps = example.steps.slice(0, maxStepsAllowed);

          // Пересчитываем финальную позицию после обрезки
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

        // Для многозначного режима (digitCount > 1 и combineLevels === false)
        // проверим, что промежуточные состояния не выходят за допустимый диапазон
        if (digitCount > 1 && !combineLevels) {
          if (!this._validateIntermediateStates(example)) {
            console.warn(
              `⚠️ Попытка ${attempt}: промежуточные состояния вышли за диапазон`
            );
            continue;
          }
        }

        // Финальная методическая валидация правилом
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
   * Генерация для одного разряда (digitCount === 1) в режиме "Просто".
   *
   * Логика:
   * - стартуем с 0;
   * - первый шаг всегда положительный;
   * - дальше можно и плюс, и минус;
   * - каждый шаг — это ±d, где d ∈ selectedDigits из UnifiedSimpleRule;
   * - шаг разрешён только если после него состояние остаётся в допустимом диапазоне
   *   (0..4 если верхняя бусина выключена, или 0..9 если включена);
   * - мы не навязываем формулы ("через 5"), не заставляем вводить 5,
   *   не чиним хвост.
   */
  _generateSingleDigitAttempt() {
    // стартуем из начального состояния правила (обычно 0)
    const start = this.rule.generateStartState();
    let stepsCount = this.rule.generateStepsCount();

    // уважаем minSteps
    const minSteps = this.rule.config?.minSteps ?? 2;
    if (stepsCount < minSteps) stepsCount = minSteps;

    const steps = [];
    let currentState = start;

    for (let i = 0; i < stepsCount; i++) {
      const isFirstAction = i === 0 && steps.length === 0;

      // спросить у правила доступные шаги из текущего состояния
      const availableActions = this.rule.getAvailableActions(
        currentState,
        isFirstAction
      );

      // если действий нет — обрываем пример чуть раньше
      if (!availableActions || availableActions.length === 0) {
        break;
      }

      // случайный шаг
      const action =
        availableActions[
          Math.floor(Math.random() * availableActions.length)
        ];

      // применяем
      const newState = this.rule.applyAction(currentState, action);

      // записать шаг
      steps.push({
        action,
        fromState: currentState,
        toState: newState
      });

      // состояние после шага становится текущим
      currentState = newState;
    }

    return {
      start,
      steps,
      answer: currentState
    };
  }

  /**
   * Генерация для многозначных примеров (digitCount > 1).
   *
   * Логика:
   * - состояние — массив по разрядам: [единицы, десятки, сотни, ...];
   * - каждый шаг = ОДИН общий жест по всем разрядам;
   *   то есть мы одновременно двигаем каждый разряд,
   *   но у всех разрядов знак на этом шаге один (+ или -);
   * - первый общий шаг не может быть минусом;
   * - никакого переноса между разрядами
   *   (ни один столбец не может стать <0 или >maxState).
   */
  _generateMultiDigitAttemptVectorBased() {
    const digitCount = this.rule.config?.digitCount || 2;
    const maxSteps = this.rule.generateStepsCount();
    const firstMustBePositive =
      this.rule.config?.firstActionMustBePositive !== false;

    // начинаем с массива нулей [0,0,...]
    let currentState = this.rule.generateStartState();
    const startState = Array.isArray(currentState)
      ? [...currentState]
      : [currentState];

    const steps = [];

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      const isFirstStep = stepIndex === 0 && steps.length === 0;

      // какой знак разрешён на этом шаге?
      const candidateSigns =
        isFirstStep && firstMustBePositive ? [+1] : [+1, -1];

      let chosenVector = null;

      // пытаемся построить валидный общий вектор для одного из разрешённых знаков
      for (const sign of candidateSigns) {
        const vectors = this._buildCandidateVectorsForSign(
          currentState,
          sign,
          isFirstStep
        );

        if (vectors.length === 0) {
          continue;
        }

        // выбираем случайный вектор
        chosenVector = vectors[Math.floor(Math.random() * vectors.length)];
        break;
      }

      // если мы не можем сделать ни один допустимый общий шаг – останавливаемся
      if (!chosenVector) {
        break;
      }

      // применяем вектор сразу ко всем разрядам
      const newState = this._applyVectorToAllDigits(currentState, chosenVector);

      steps.push({
        action: chosenVector, // массив объектов {position,value}
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
   * Построить ВСЕ допустимые векторы действий для одного общего шага
   * с заданным знаком (все плюс или все минус).
   *
   * Алгоритм:
   *  - для каждого разряда спрашиваем rule.getAvailableActions(...)
   *    → там уже учтены ограничения физики и методики:
   *      - не выйти за допустимый диапазон для этого режима (0..4 или 0..9),
   *      - не начинать с минуса,
   *      - onlyAddition / onlySubtraction,
   *      - выбранные цифры.
   *  - фильтруем эти действия по знаку;
   *  - берём декартово произведение,
   *    чтобы получить комбинации "каждому разряду — свой сдвиг";
   *  - отбрасываем комбинации, которые выбивают хоть один разряд из допустимого диапазона.
   */
  _buildCandidateVectorsForSign(currentState, sign, isFirstStep) {
    const digitCount = this.rule.config?.digitCount || 2;
    const maxAllowed = this.rule.config?.maxState ?? 9;

    // варианты по каждому разряду
    const perDigitOptions = [];

    for (let pos = 0; pos < digitCount; pos++) {
      const localActions = this.rule.getAvailableActions(
        currentState,
        isFirstStep,
        pos
      );

      // фильтруем по знаку:
      // sign = +1 → берём только value > 0
      // sign = -1 → берём только value < 0
      const filtered = localActions.filter(a => {
        const v = typeof a === "object" ? a.value : a;
        return sign > 0 ? v > 0 : v < 0;
      });

      // если для этого разряда нет ни одной дельты с нужным знаком → весь вектор невозможен
      if (filtered.length === 0) {
        return [];
      }

      // нормализуем к формату { position, value }
      const normalized = filtered.map(a => {
        if (typeof a === "object") {
          return a;
        } else {
          return { position: pos, value: a };
        }
      });

      perDigitOptions.push(normalized);
    }

    // декартово произведение: берём по одному действию на каждый разряд
    const allCombos = this._cartesian(perDigitOptions);

    // проверяем, что применение такой комбинации не выбивает ни один разряд за допустимые пределы
    const validCombos = allCombos.filter(vector => {
      const newState = this._applyVectorToAllDigits(currentState, vector);
      if (newState.some(d => d < 0)) return false;
      if (newState.some(d => d > maxAllowed)) return false;
      return true;
    });

    return validCombos;
  }

  /**
   * Применяет вектор [{position, value}, ...] к состоянию массива разрядов.
   * Возвращает новое состояние (массив).
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
   * чтобы получить все возможные комбинации "по одному действию на каждый разряд".
   * Пример:
   *   вход: [ [a,b], [c,d] ]
   *   выход: [ [a,c], [a,d], [b,c], [b,d] ]
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
   * Проверка промежуточных состояний в многозначном режиме.
   * Мы запрещаем любые состояния, где какой-то разряд <0
   * или > допустимого максимума для этого режима (4 или 9).
   */
  _validateIntermediateStates(example) {
    const digitCount = this.rule.config?.digitCount || 1;
    if (digitCount === 1) return true;

    const maxAllowed = this.rule.config?.maxState ?? 9;

    // проверяем все промежуточные состояния
    for (let i = 0; i < example.steps.length; i++) {
      const stateArr = example.steps[i].toState;
      if (Array.isArray(stateArr)) {
        if (stateArr.some(d => d < 0 || d > maxAllowed)) {
          console.warn(
            `❌ Шаг ${i + 1}: состояние [${stateArr.join(
              ", "
            )}] содержит недопустимое значение`
          );
          return false;
        }
      }
    }

    // и финальное состояние
    const finalArr = example.answer;
    if (Array.isArray(finalArr)) {
      if (finalArr.some(d => d < 0 || d > maxAllowed)) {
        console.warn(
          `❌ Финал содержит недопустимую цифру [${finalArr.join(", ")}]`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Форматируем пример в строку для отладки / логов.
   * Пример: "+3 +1 -4 = 0"
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
   * Формат для trainer_logic.js / UI.
   *
   * - если 1 разряд:
   *      steps: ["+3", "+1", "-4", ...]
   *      answer: 0
   *
   * - если много разрядов:
   *      для каждого шага у нас есть вектор [{position,value}, ...],
   *      мы превращаем его в строку вроде "+32" или "-805"
   *      (знак общий, дальше абсолютные значения по разрядам от старшего к младшему).
   */
  toTrainerFormat(example) {
    const digitCount = this.rule.config?.digitCount || 1;

    // многозначный случай
    if (digitCount > 1 && Array.isArray(example.start)) {
      const formattedSteps = [];

      for (const step of example.steps) {
        // step.action — это массив [{position,value}, ...]
        const vector = Array.isArray(step.action)
          ? step.action
          : [step.action];

        // Собираем по позициям
        // position: 0 = единицы, 1 = десятки, ...
        const byPos = [];
        for (const part of vector) {
          byPos[part.position] = part.value;
        }

        // Определяем общий знак шага
        const signValue = byPos.find(v => v !== 0) || 0;
        const signStr = signValue >= 0 ? "+" : "-";

        // Строим строку абсолютных значений от старшего к младшему
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

    // одноразрядный случай
    return {
      start: this.rule.stateToNumber(example.start),
      steps: example.steps.map(step => this.rule.formatAction(step.action)),
      answer: this.rule.stateToNumber(example.answer)
    };
  }

  /**
   * Валидация примера при необходимости.
   * Обычно просто делегируем правилу.
   */
  validate(example) {
    if (this.rule.validateExample) {
      return this.rule.validateExample(example);
    }
    return true;
  }

  /**
   * Сгенерировать несколько примеров подряд.
   * Возвращает массив примеров.
   */
  generateMultiple(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(this.generate());
    }
    return out;
  }
}
