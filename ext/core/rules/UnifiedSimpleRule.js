// ext/core/rules/UnifiedSimpleRule.js
//
// Правило для блока "Просто":
// - работаем на одной стойке абакуса без переноса
// - каждый шаг = ОДИН жест ребёнка
// - жест может одновременно менять верхнюю бусину (5) и любое число нижних бусин (1..4)
//   => поэтому допустимы шаги с модулем 1..9
// - мы НИКОГДА не выходим за пределы [0..9] на стойке
// - первый шаг всегда плюсовой
// - мы уважаем настройки onlyAddition / onlySubtraction
//
// Физика стойки:
//   v ∈ [0..9]
//   upperActive = v >= 5
//   lowerActive = v % 5  (0..4)
//
// canDoInOneGesture(v, v2):
//   Можно ли одним жестом перейти из состояния v в состояние v2?
//   В "Просто" мы разрешаем ОДНОВРЕМЕННО:
//     - поднять/опустить верхнюю бусину (5) И
//     - поднять/опустить любое количество нижних бусин,
//   то есть комбо вроде +7, -8 и т.д. допустимы,
//   если результат физически достижим (никаких промежуточных переносов,
//   и количество нижних после жеста 0..4).
//
// Единственные реальные запреты:
//   - нельзя получить нижние <0 или >4;
//   - нельзя выйти за диапазон 0..9;
//   - нельзя "оставить половину верхней" — верхняя либо включена, либо выключена;
//   - нельзя начать с минуса.
//
// includeFive=false трактуем строго методически как "верхняя бусина не используется".
// То есть тогда мы выбрасываем все дельты >=5, т.е. и 5,6,7,8,9.

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // что выбрал пользователь как разрешённые абсолютные шаги
    const rawDigits = Array.isArray(config.selectedDigits)
      ? config.selectedDigits
      : [1, 2, 3, 4];

    // includeFive: можно ли использовать верхнюю бусину вообще?
    // если includeFive=false => запрещаем любые шаги, которые требуют верхнюю
    // (то есть модули >=5)
    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        rawDigits.includes(5)) === true;

    // фильтруем разрешённые шаги
    let selectedDigits = rawDigits
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 9)
      .filter(n => {
        if (!includeFive) {
          // не трогаем верхнюю бусину вообще
          // => разрешаем только 1..4
          return n <= 4;
        }
        // includeFive=true -> можно 1..9
        return true;
      });

    // fallback: если вообще ничего не осталось (например юзер выбрал только 7,
    // а includeFive=false, выкинули 7 и получили пусто),
    // чтобы генератор не умер — разрешим хотя бы "1".
    if (selectedDigits.length === 0) {
      selectedDigits = includeFive ? [1, 2, 3, 4, 5] : [1];
    }

    this.name = "Просто";
    this.description =
      "Одноразрядные жесты без переноса. Один шаг может одновременно менять верхнюю и нижние бусины.";

    this.config = {
      // стойка 0..9
      minState: 0,
      maxState: 9,

      // длина примера
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // то, что ребёнку разрешено как МОДУЛЬ шага (1..9)
      selectedDigits,

      // методический флаг верхней бусины
      includeFive,
      hasFive: includeFive,

      // методика:
      firstActionMustBePositive: true,

      // разрядность
      digitCount: config.digitCount ?? 1,

      // совместимость с остальным кодом
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule init:
  selectedDigits(afterFilter)=[${this.config.selectedDigits.join(", ")}]
  includeFive=${this.config.includeFive}
  digitCount=${this.config.digitCount}
  minSteps=${this.config.minSteps}
  maxSteps=${this.config.maxSteps}
  onlyAddition=${this.config.onlyAddition}
  onlySubtraction=${this.config.onlySubtraction}
  firstActionMustBePositive=${this.config.firstActionMustBePositive}`
    );
  }

  /**
   * случайная длина примера в [minSteps..maxSteps]
   */
  generateStepsCount() {
    const min = this.config.minSteps ?? 2;
    const max = this.config.maxSteps ?? min;
    if (min === max) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /**
   * начальное состояние стойки
   * один разряд -> 0
   * несколько разрядов -> массив нулей
   */
  generateStartState() {
    const dc = this.config.digitCount ?? 1;
    if (dc === 1) return 0;
    return Array(dc).fill(0);
  }

  /**
   * строковое представление шага для UI
   */
  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    return action >= 0 ? `+${action}` : `${action}`;
  }

  /**
   * получить значение конкретного разряда (0..9)
   */
  getDigitValue(currentState, position = 0) {
    if (Array.isArray(currentState)) {
      return currentState[position] ?? 0;
    }
    return currentState ?? 0;
  }

  /**
   * применить шаг к состоянию
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
      const v = this.getDigitValue(currentState, 0);
      return v + action;
    }
  }

  /**
   * преобразовать состояние в число (для UI, проверки ответа)
   * массив трактуем как [единицы, десятки, ...]
   */
  stateToNumber(state) {
    if (Array.isArray(state)) {
      return state.reduce(
        (sum, digit, index) => sum + digit * Math.pow(10, index),
        0
      );
    }
    return state ?? 0;
  }

  /**
   * проверить что состояние валидно: каждый разряд 0..9
   */
  isValidState(state) {
    const { minState, maxState } = this.config;
    if (Array.isArray(state)) {
      return state.every(v => v >= minState && v <= maxState);
    }
    return state >= minState && state <= maxState;
  }

  /**
   * ВСПОМОГАТЕЛЬНО:
   * можно ли перейти из v в v2 за ОДИН жест "Просто"?
   *
   * v,v2 в [0..9]
   *
   * Расшифровка:
   *   u1 = v >= 5       верхняя была активна?
   *   l1 = v % 5        сколько нижних было активно (0..4)
   *   u2 = v2 >= 5      верхняя стала активна?
   *   l2 = v2 % 5       сколько нижних стало активно (0..4)
   *
   * В "Просто" один жест может:
   *   - одновременно менять верхнюю (вкл/выкл)
   *   - и переустанавливать нижние в любое другое количество (0..4)
   *
   * Так что почти любое (u1,l1) -> (u2,l2) разрешено,
   * при двух условиях:
   *   1) l2 между 0 и 4 (гарантируется, так как v2<=9)
   *   2) v2 в диапазоне [0..9] (мы и так проверяем перед вызовом)
   *
   * То есть canDoInOneGesture в нашей модели = (v2 в [0..9])
   * НО! методическое ограничение includeFive=false:
   * если includeFive=false, то мы вообще не позволяем менять верхнюю бусину.
   * Значит если u1 != u2 (верхняя изменилась), такой жест запрещён.
   */
  canDoInOneGesture(v, v2) {
    if (v2 < 0 || v2 > 9) return false;

    const u1 = v >= 5;
    const u2 = v2 >= 5;

    const { includeFive } = this.config;

    if (!includeFive) {
      // нельзя вообще трогать верхнюю
      // => верхняя должна оставаться такой же
      if (u1 !== u2) return false;
      // нижние можно менять сколько угодно за раз (в пределах 0..4), это ок
      return true;
    }

    // includeFive === true:
    // верхнюю можно и включать, и выключать в том же жесте,
    // нижние можно на любое другое количество сразу.
    return true;
  }

  /**
   * КЛЮЧЕВАЯ ФУНКЦИЯ:
   * какие шаги (действия) допустимы из текущего состояния?
   *
   * Возвращаем либо массив чисел [+3, -2, ...] для одного разряда,
   * либо массив объектов [{position, value}, ...] если разрядов несколько.
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      selectedDigits,
      onlyAddition,
      onlySubtraction,
      digitCount
    } = this.config;

    const v = this.getDigitValue(currentState, position);
    const deltas = new Set();

    for (const d of selectedDigits) {
      // кандидат +d
      if (!onlySubtraction) {
        // даже если onlySubtraction==true — но это уже отфильтровано выше
        const v2 = v + d;

        // первый шаг МОЖЕТ быть только плюсом,
        // но это не ограничивает нас здесь, потому что плюс и так плюс :)
        // нам надо только проверить физику и диапазон
        if (v2 >= 0 && v2 <= 9) {
          if (this.canDoInOneGesture(v, v2)) {
            deltas.add(+d);
          }
        }
      }

      // кандидат -d
      if (!onlyAddition) {
        // минус на первом шаге запрещён методически
        if (!isFirstAction) {
          const v2 = v - d;
          if (v2 >= 0 && v2 <= 9) {
            if (this.canDoInOneGesture(v, v2)) {
              deltas.add(-d);
            }
          }
        }
      }
    }

    const resultDeltas = Array.from(deltas);

    // многоразрядный режим → возвращаем объекты {position,value}
    if (digitCount > 1) {
      return resultDeltas.map(value => ({ position, value }));
    }

    // лог для отладки
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;
    console.log(
      `⚙️ getAvailableActions(simple): state=${stateStr}, v=${v} → [${resultDeltas.join(
        ", "
      )}]`
    );

    return resultDeltas;
  }

  /**
   * Проверка валидности финального примера (после генерации).
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const { digitCount, selectedDigits, minState, maxState } = this.config;

    // 1. старт = 0
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Стартовое состояние ${startNum} ≠ 0`);
      return false;
    }

    // 2. первый шаг должен быть плюсом (>0)
    if (steps.length > 0) {
      const firstActionRaw = steps[0].action;
      const firstValue =
        typeof firstActionRaw === "object"
          ? firstActionRaw.value
          : firstActionRaw;

      if (firstValue <= 0) {
        console.error(`❌ Первое действие ${firstValue} не положительное`);
        return false;
      }
    }

    // 3. промежуточные состояния валидны
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        const s = Array.isArray(step.toState)
          ? `[${step.toState.join(", ")}]`
          : step.toState;
        console.error(
          `❌ Недопустимое состояние ${s} вне диапазона ${minState}..${maxState}`
        );
        return false;
      }
    }

    // 4. арифметика: start + все action = answer
    let calc = start;
    for (const step of steps) {
      calc = this.applyAction(calc, step.action);
    }
    const calcNum = this.stateToNumber(calc);
    const answerNum = this.stateToNumber(answer);
    if (calcNum !== answerNum) {
      console.error(
        `❌ Пересчёт ${calcNum} ≠ заявленному answer ${answerNum}`
      );
      return false;
    }

    // 5. финал:
    // для одной стойки - ответ должен быть либо 0,
    // либо в одном из разрешённых положений (selectedDigits)
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
      // многоразрядный режим: просто проверяем что состояние валидно
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
      `✅ Пример валиден (${this.name}): финал=${answerNum}, разрешённые финалы {0, ${selectedDigits.join(
        ", "
      )}}`
    );
    return true;
  }
}
