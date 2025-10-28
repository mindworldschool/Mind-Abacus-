// ext/core/rules/UnifiedSimpleRule.js
//
// Правило "Просто": генерация допустимых одношаговых движений без переноса,
// строго по физике абакуса.
//
// Основные договорённости:
//
// - У нас есть одна стойка абакуса (сейчас работаем в digitCount=1, но код
//   уже не ломается, если потом будет больше).
//
// - Состояние стойки — это число 0..9, где:
//     0..4  → активны только нижние бусины (по 1)
//     5..9  → активна верхняя (5) + часть нижних
//
//   Примеры состояния и активных бусин:
//     0 → (ничего активно)
//     3 → (три нижние активны)
//     5 → (только верхняя активна)
//     7 → (верхняя + две нижние)
//     9 → (верхняя + четыре нижние)
//
// - Один ЖЕСТ (action) — это одно физическое движение руки ребёнка в рамках блока "Просто":
//     • вверх (добавляем значение на стойке),
//     • вниз (снимаем значение со стойки).
//
//   Жест может:
//   - поднять сразу несколько нижних бусин за раз (+1..+4),
//   - опустить сразу несколько нижних бусин за раз (-1..-4),
//   - поднять или опустить верхнюю бусину (+5 / -5),
//   - поднять или опустить верхнюю И сразу k нижних (+6..+9 / -6..-9).
//
//   Но жест НЕ может:
//   - одновременно что-то поднять и что-то опустить,
//   - делать "перенос" через сложную последовательность (типа +4 потом перестроить в 9),
//   - выдумывать 8 как "+4, потом ещё движение" — это уже 2 жеста, не 1.
//
// - Первый шаг в примере всегда должен быть положительным (мы не можем начать с минуса из 0).
//
// - Мы разрешаем только те по модулю шаги, которые выбраны в блоке "Просто".
//   То есть если выбрано только [4], то весь пример будет состоять из +4/-4
//   и переходов, где +4 и -4 физически возможны из текущего состояния.
//   Если выбрано только [7], то у ребёнка будут шаги +7/-7 и так далее.
//
// - Если выбраны цифры >=5, то это автоматически значит, что нам разрешено
//   трогать верхнюю бусину. Пользователь не обязан отдельно включать "5".
//   Без верхней невозможно сделать 6,7,8,9 вообще. Это мы чиним тут.


import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // (1) Какие абсолютные цифры разрешены в блоке "Просто"
    // Например [1,2,3,4] или [6] или [2,7,9] и т.д.
    const selectedDigitsRaw = config.selectedDigits || [1, 2, 3, 4];
    // нормализуем числа
    const selectedDigits = Array.from(
      new Set(
        selectedDigitsRaw
          .map(n => parseInt(n, 10))
          .filter(n => Number.isFinite(n) && n >= 1 && n <= 9)
      )
    ).sort((a, b) => a - b);

    // (2) Нужна ли верхняя бусина
    // Если среди выбранных есть 5..9, это означает,
    // что физически ребёнок будет работать с верхней бусиной.
    // Значит мы обязаны разрешать её трогать.
    const needsTopBead = selectedDigits.some(d => d >= 5);

    // (3) includeFive:
    //   - если needsTopBead === true → автоматически true;
    //   - иначе уважаем то, что пришло извне (UI/настройки).
    const includeFive =
      needsTopBead ||
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    this.name = "Просто";
    this.description =
      "Одноразрядные шаги без переноса. Каждый шаг = один физический жест.";

    this.config = {
      // физические пределы:
      minState: 0,
      maxState: 9,

      // длина цепочки
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // выбранные цифры ребёнком (какие шаги по модулю разрешены)
      selectedDigits,
      includeFive,
      hasFive: includeFive, // чтобы старый код не падал

      // методические ограничения
      firstActionMustBePositive: true,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,

      // многоразрядная совместимость
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,

      // будем прокидывать флаги будущих режимов, чтобы не падал код
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // блоки (чтобы в будущем можно было смотреть)
      blocks: config.blocks ?? {},

      // остальное оставим на всякий случай
      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule инициализировано:
  digitsAllowed=[${selectedDigits.join(", ")}]
  includeFive=${includeFive}
  digitCount=${this.config.digitCount}
  minSteps=${this.config.minSteps}
  maxSteps=${this.config.maxSteps}
  onlyAddition=${this.config.onlyAddition}
  onlySubtraction=${this.config.onlySubtraction}
  firstActionMustBePositive=${this.config.firstActionMustBePositive}`
    );
  }

  /**
   * Генерация стартового состояния.
   * Для "Просто" (один столбец) — всегда 0.
   * Для будущих многозначных — массив нулей.
   */
  generateStartState() {
    const dc = this.config.digitCount || 1;
    if (dc === 1) {
      return 0;
    }
    return Array(dc).fill(0);
  }

  /**
   * Случайная длина цепочки в пределах [minSteps..maxSteps].
   */
  generateStepsCount() {
    const min = this.config.minSteps ?? 2;
    const max = this.config.maxSteps ?? min;
    if (min === max) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /**
   * Формат действия для отображения (например "+3" или "-7").
   * Если потом будем работать с несколькими разрядами и вектором {position,value},
   * то отформатируем value.
   */
  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      // многоразрядный случай: { position, value }
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    // одиночный разряд (число)
    return action >= 0 ? `+${action}` : `${action}`;
  }

  /**
   * Получить значение конкретного столбца (по умолчанию у нас один столбец).
   */
  getDigitValue(state, position = 0) {
    if (Array.isArray(state)) {
      return state[position] ?? 0;
    }
    return state ?? 0;
  }

  /**
   * Применить шаг к состоянию.
   * - Если action это число → просто сложить с текущим значением одного столбца.
   * - Если action это {position,value} → применить к конкретной позиции в массиве.
   */
  applyAction(currentState, action) {
    if (typeof action === "object" && action !== null) {
      const arr = Array.isArray(currentState)
        ? [...currentState]
        : [currentState];
      const { position, value } = action;
      arr[position] = (arr[position] ?? 0) + value;
      return arr;
    } else {
      // одиночный разряд
      const v = this.getDigitValue(currentState, 0);
      return v + action;
    }
  }

  /**
   * Преобразовать состояние (число или массив) в одно число.
   * Для массива [единицы, десятки, сотни] → склеиваем как десятки:
   *   [3,2,1] → 123.
   */
  stateToNumber(state) {
    if (Array.isArray(state)) {
      // позиция 0 → единицы, 1 → десятки, ...
      return state.reduce(
        (sum, digit, idx) => sum + digit * Math.pow(10, idx),
        0
      );
    }
    return state ?? 0;
  }

  /**
   * Проверка, валидно ли состояние (все разряды в пределах 0..9).
   */
  isValidState(state) {
    const { minState, maxState } = this.config;
    if (Array.isArray(state)) {
      return state.every(
        v => v >= minState && v <= maxState
      );
    }
    return state >= minState && state <= maxState;
  }

  /**
   * === СЕРДЦЕ ЛОГИКИ ===
   *
   * На основе ТЕКУЩЕГО состояния стойки (v) и правил,
   * вернуть список всех ДЕЙСТВИЙ (шагов) которые мы МОЖЕМ сейчас сделать
   * одним жестом.
   *
   * Возвращаем массив действий:
   *   - в одноразрядном режиме: числа [+3, -2, +7, ...]
   *   - в многоразрядном будущем: объекты вида { position, value }
   *
   * Алгоритм:
   *   1. Берём текущее значение v (0..9).
   *   2. Идём по всем возможным целевым значениям v2 (0..9).
   *   3. Проверяем, существует ли одно-жестовый переход v -> v2.
   *      (isOneGestureTransition)
   *   4. Если да, считаем delta = v2 - v.
   *   5. Разрешаем delta, только если |delta| ∈ selectedDigits,
   *      и delta удовлетворяет методике:
   *        - первый шаг не может быть отрицательным,
   *        - если onlyAddition → только плюсы,
   *        - если onlySubtraction → только минусы (кроме самого первого шага, где минус запрещён).
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      digitCount,
      selectedDigits,
      onlyAddition,
      onlySubtraction
    } = this.config;

    const v = this.getDigitValue(currentState, position); // текущее значение в этом столбце
    const out = [];

    // перебираем все возможные будущие состояния (0..9)
    for (let v2 = 0; v2 <= 9; v2++) {
      const delta = v2 - v;
      if (delta === 0) continue; // "ничего не делаем" не считаем шагом

      const dir = delta > 0 ? "up" : "down";
      const ok = this.isOneGestureTransition(v, v2, dir);
      if (!ok) continue;

      // сам модуль дельты должен быть разрешён в блоке "Просто"
      const absDelta = Math.abs(delta);
      if (!selectedDigits.includes(absDelta)) {
        continue;
      }

      // методические ограничения:
      // 1) первый шаг не может быть минусом
      if (isFirstAction && delta < 0) {
        continue;
      }

      // 2) режим только сложение / только вычитание
      if (onlyAddition && delta < 0) {
        continue;
      }
      if (onlySubtraction && delta > 0) {
        // но если это первый шаг, мы ТОЛЬКО ЧТО запретили минус выше,
        // значит тут просто continue
        continue;
      }

      // формируем шаг
      if (digitCount > 1) {
        out.push({ position, value: delta });
      } else {
        out.push(delta);
      }
    }

    // Лог для отладки
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;
    console.log(
      `⚙️ getAvailableActions(): state=${stateStr}, pos=${position}, v=${v} → [${out
        .map(a => (typeof a === "object" ? a.value : a))
        .join(", ")}]`
    );

    return out;
  }

  /**
   * Проверяет, можем ли мы сделать ПРЯМОЙ одно-жестовый переход со стойки
   * из значения v в значение v2, с направлением dir ("up" или "down").
   *
   * Физическая модель:
   *   - Стоимость верхней бусины = 5.
   *   - Кол-во активных нижних бусин = v % 5, но:
   *        если v < 5 → верхняя неактивна, нижние = v
   *        если v >= 5 → верхняя активна, нижние = v-5
   *
   * Жест "вверх":
   *   - мы МАССОВО активируем несколько нижних бусин И/ИЛИ верхнюю,
   *   - ничего не деактивируем.
   *
   * Жест "вниз":
   *   - мы МАССОВО деактивируем несколько нижних бусин И/ИЛИ верхнюю,
   *   - ничего не активируем.
   *
   * Жест НЕ может одновременно что-то активировать и что-то деактивировать.
   */
  isOneGestureTransition(v, v2, dir) {
    // быстрое отсеивание
    if (v2 < 0 || v2 > 9) return false;
    if (dir === "up" && v2 <= v) return false;
    if (dir === "down" && v2 >= v) return false;

    // раскладываем состояние v во "включена ли верхняя" и "сколько нижних включено"
    const wasTop = v >= 5;
    const wasBot = wasTop ? (v - 5) : v; // 0..4

    const isTop = v2 >= 5;
    const isBot = isTop ? (v2 - 5) : v2; // 0..4

    // вычислим изменения по верхней бусине и по нижним
    const topChange = (isTop ? 1 : 0) - (wasTop ? 1 : 0);    // -1,0,+1
    const botChange = isBot - wasBot;                        // -4..+4

    // жест вверх:
    //   можно только добавлять (topChange >=0, botChange >=0),
    //   хотя бы что-то должно добавиться
    if (dir === "up") {
      if (topChange < 0) return false;
      if (botChange < 0) return false;
      if (topChange === 0 && botChange === 0) return false; // нет движения
      return true;
    }

    // жест вниз:
    //   можно только снимать (topChange <=0, botChange <=0),
    //   хотя бы что-то должно сняться
    if (dir === "down") {
      if (topChange > 0) return false;
      if (botChange > 0) return false;
      if (topChange === 0 && botChange === 0) return false; // нет движения
      return true;
    }

    return false;
  }

  /**
   * Финальная валидация сгенерированного примера.
   * Условия:
   *  1. мы стартуем из 0 (или [0,...]).
   *  2. первый шаг положительный.
   *  3. каждое промежуточное состояние валидно (0..9 по каждому разряду).
   *  4. арифметически применение шагов приводит к answer.
   *  5. для одного разряда финал должен быть либо 0,
   *     либо одной из выбранных цифр (это наш методический коридор).
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const {
      digitCount,
      selectedDigits,
      minState,
      maxState
    } = this.config;

    // 1. старт должен быть 0
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Стартовое состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. первый шаг должен быть строго положительным
    if (steps.length > 0) {
      const firstActionRaw = steps[0].action;
      const firstVal =
        typeof firstActionRaw === "object"
          ? firstActionRaw.value
          : firstActionRaw;
      if (firstVal <= 0) {
        console.error(
          `❌ Первое действие ${firstVal} не положительное`
        );
        return false;
      }
    }

    // 3. все промежуточные состояния должны быть валидны
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const stateStr = Array.isArray(step.toState)
          ? `[${step.toState.join(", ")}]`
          : step.toState;
        console.error(
          `❌ Недопустимое состояние ${stateStr} (вне ${minState}..${maxState})`
        );
        return false;
      }
    }

    // 4. проверяем арифметику целиком
    let calcState = start;
    for (const step of steps) {
      calcState = this.applyAction(calcState, step.action);
    }
    const calcNum = this.stateToNumber(calcState);
    const answerNum = this.stateToNumber(answer);

    if (calcNum !== answerNum) {
      console.error(
        `❌ Пересчёт дал ${calcNum}, а answer=${answerNum}`
      );
      return false;
    }

    // 5. методический финал
    if (digitCount === 1) {
      const allowedFinals = new Set([0, ...selectedDigits]);
      if (!allowedFinals.has(answerNum)) {
        console.error(
          `❌ Финальный ответ ${answerNum} не входит в {0, ${selectedDigits.join(
            ", "
          )}}`
        );
        return false;
      }
    } else {
      // будущий многозначный режим: просто проверяем диапазон
      if (!this.isValidState(answer)) {
        console.error(
          `❌ Финальное состояние ${JSON.stringify(
            answer
          )} выходит за пределы ${minState}..${maxState}`
        );
        return false;
      }
    }

    console.log(
      `✅ Пример валиден (${this.name}): финал=${answerNum}`
    );
    return true;
  }
}
