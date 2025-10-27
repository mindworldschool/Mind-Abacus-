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

        // 🔧 ограничиваем количество шагов до maxSteps и пересчитываем ответ, если надо
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

        // Лёгкая проверка промежуточных состояний для многозначного режима
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
   * ГЕНЕРАТОР для многозначных примеров (digitCount > 1).
   *
   * Логика:
   * - состояние — массив по разрядам: [единицы, десятки, ...];
   * - один шаг = общий жест: каждый разряд двигается своим +N/-N,
   *   но знак шага общий (все плюс или все минус в этом такте);
   * - getAvailableActions(...) для каждого разряда уже возвращает допустимые дельты;
   * - первый общий шаг не может быть отрицательным;
   * - никакой перенос за пределы 0..9.
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

      // Не нашли ни одного возможного общего шага — останавливаем пример
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
   * - getAvailableActions(...) по каждому разряду возвращает список
   *   возможных шагов для ЭТОГО разряда.
   * - фильтруем шаги по знаку.
   * - собираем декартово произведение, чтобы получить комбинации.
   * - фильтруем комбинации, которые ломают диапазон (какой-то разряд <0 или >9).
   */
  _buildCandidateVectorsForSign(currentState, sign, isFirstStep) {
    const digitCount = this.rule.config?.digitCount || 2;

    // 1. Список возможных локальных действий по каждому разряду
    const perDigitOptions = [];

    for (let pos = 0; pos < digitCount; pos++) {
      const localActions = this.rule.getAvailableActions(
        currentState,
        isFirstStep,
        pos
      );

      // Оставляем только те, что соответствуют нужному знаку:
      // sign = +1 -> value > 0
      // sign = -1 -> value < 0
      const filtered = localActions.filter(a => {
        const v = (typeof a === "object") ? a.value : a;
        return sign > 0 ? v > 0 : v < 0;
      });

      // Если в каком-то разряде нет хода с этим знаком — значит общий шаг с этим знаком невозможен
      if (filtered.length === 0) {
        return [];
      }

      // Нормализуем к формату { position, value }
      const normalized = filtered.map(a => {
        if (typeof a === "object") {
          return a;
        } else {
          return { position: pos, value: a };
        }
      });

      perDigitOptions.push(normalized);
    }

    // 2. Декартово произведение: берём по одному действию на каждый разряд
    const allCombos = this._cartesian(perDigitOptions);

    // 3. Фильтруем комбинации, которые приводят хоть один разряд за 0..9
    const validCombos = allCombos.filter(vector => {
      const newState = this._applyVectorToAllDigits(currentState, vector);
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
   * ГЕНЕРАЦИЯ ДЛЯ ОДНОГО РАЗРЯДА (digitCount === 1) в режиме "Просто".
   *
   * Логика:
   * - стартуем из 0;
   * - первый шаг всегда положительный;
   * - дальше можно и плюс, и минус;
   * - каждый шаг — это ±d, где d ∈ selectedDigits правила;
   * - шаг допустим только если состояние остаётся в 0..9;
   * - без обязательных "блоков через 5", без приоритетов пятёрки,
   *   без искусственного ремонта хвоста.
   */
  _generateAttempt() {
    // 1. стартовое состояние (для "Просто" это 0)
    const start = this.rule.generateStartState
      ? this.rule.generateStartState()
      : 0;

    // 2. количество шагов
    let stepsCount = this.rule.generateStepsCount
      ? this.rule.generateStepsCount()
      : (this.rule.config?.maxSteps ?? 4);

    const minSteps = this.rule.config?.minSteps ?? 2;
    if (stepsCount < minSteps) stepsCount = minSteps;

    const steps = [];
    let currentState = start;

    for (let i = 0; i < stepsCount; i++) {
      const isFirstAction = (i === 0 && steps.length === 0);

      // спрашиваем правило о возможных ходах сейчас
      let availableActions = this.rule.getAvailableActions(
        currentState,
        isFirstAction
      );

      // тупик — останавливаем пример чуть короче
      if (!availableActions || availableActions.length === 0) {
        break;
      }

      // случайный выбор действия
      const action =
        availableActions[Math.floor(Math.random() * availableActions.length)];

      // применяем
      const newState = this.rule.applyAction(currentState, action);

      // добавляем шаг
      steps.push({
        action,
        fromState: currentState,
        toState: newState
      });

      // двигаемся дальше
      currentState = newState;
    }

    // готовим пример
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

        // Определяем знак шага
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
