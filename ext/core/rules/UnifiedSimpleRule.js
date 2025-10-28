// ext/core/rules/UnifiedSimpleRule.js
//
// Правило "Просто":
//  - один столбец абакуса без переноса между разрядами
//  - последовательные жесты ученика: +N / -N
//  - каждый жест = РОВНО ОДНО физическое движение руки
//
// Ключевые условия, которые мы применяем тут:
//
// 1. Стойка (один разряд абакуса):
//    - нижние бусины: до 4 штук, каждая = +1
//    - верхняя бусина: 1 штука, = +5
//
// 2. Значение разряда — это активные бусины:
//      value = (верхняя активна? 5 : 0) + (кол-во активных нижних)
//
// 3. Жест (один шаг в примере) — это одно осмысленное действие ребёнка,
//    и оно должно соответствовать одному из разрешённых паттернов:
//
//    Прибавить (direction = +1):
//      A. активировать одну нижнюю бусину (+1), если есть неактивная
//      B. активировать верхнюю бусину (+5), если она неактивна
//      C. активировать верхнюю И одну нижнюю ОДНИМ жестом (+6),
//         если верхняя неактивна и есть хотя бы 1 свободная нижняя
//      D. активировать верхнюю И 2 нижние ОДНИМ жестом (+7),
//         если верхняя неактивна и есть >=2 свободных нижних
//      E. активировать верхнюю И 3 нижние ОДНИМ жестом (+8),
//         если верхняя неактивна и есть >=3 свободных нижних
//      F. активировать верхнюю И 4 нижние ОДНИМ жестом (+9),
//         если верхняя неактивна и есть >=4 свободных нижних
//
//      ❗ мы НЕ разрешаем последовательные микрооперации в одном шаге
//         типа "сначала поднял 5, потом добавил +1" если это НЕ один жест.
//         Т.е. +2, +3, +4 возможны только если реально можно активировать
//         2,3,4 нижние бусины одним жестом (мы считаем да).
//
//      Важно: мы не разрешаем "перенос через 5":
//         например из 4 в 6 как "+2": в реальности ребёнок бы сделал
//         жест (опусти 4 нижние, подними верхнюю и одну нижнюю),
 //        то есть это другая методика (перенос). В блоке "Просто" такого нет.
//         Значит +2 из состояния 4 в состояние 6 здесь ЗАПРЕЩЕН,
//         потому что это не «чистое добавление двух нижних».
//         В общем правиле ниже это учитывается.
//
//    Убавить (direction = -1):
//      A. деактивировать одну нижнюю бусину (-1), если есть активная нижняя
//      B. деактивировать верхнюю бусину (-5), если верхняя активна
//      C. деактивировать верхнюю И одну нижнюю ОДНИМ жестом (-6),
//         если верхняя активна и есть >=1 активная нижняя
//      D. деактивировать верхнюю И 2 нижние ОДНИМ жестом (-7),
//         ...
//      E. деактивировать верхнюю И 3 нижние ОДНИМ жестом (-8)
//      F. деактивировать верхнюю И 4 нижние ОДНИМ жестом (-9)
//
// 4. selectedDigits из UI = какие по модулю Δ разрешено тренировать.
//    Если выбрали [1,4], то шаги могут быть ±1 и ±4
//    (но только если этот ±1 или ±4 физически допустим одним жестом).
//
// 5. Первый шаг не может быть отрицательным.
//
// 6. onlyAddition / onlySubtraction тоже учитываются
//
// 7. includeFive=false → запрещаем любые жесты, где участвует верхняя бусина,
//    то есть всё, что требует трогать +5/-5.
//
// ------------------------------------------------------------

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    // Список разрешённых модулей шага из UI (пример: [1,2,3,4,5,6,7,8,9])
    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];

    // Разрешено ли использовать верхнюю бусину (5)
    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    this.name = "Просто";
    this.description =
      "Одноразрядные жесты без переноса через 5 и без братьев/друзей";

    this.config = {
      // Пределы стойки: 0..9
      minState: 0,
      maxState: 9,

      // Длина примера
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 6,

      // Какие |Δ| вообще разрешены тренировать
      selectedDigits,

      includeFive,
      hasFive: includeFive, // для совместимости со старым кодом

      // первый жест обязательно положительный
      firstActionMustBePositive: true,

      // одноразрядность по умолчанию
      digitCount: config.digitCount ?? 1,

      // флаги
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,

      // не используем прямо сейчас, но сохраняем
      requireBlock: config.requireBlock ?? false,
      blockPlacement: config.blockPlacement ?? "auto",

      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule init:
   digitsAllowed=[${selectedDigits.join(", ")}]
   includeFive=${includeFive}
   digitCount=${this.config.digitCount}
   steps=${this.config.minSteps}..${this.config.maxSteps}
   onlyAddition=${this.config.onlyAddition}
   onlySubtraction=${this.config.onlySubtraction}
   firstActionMustBePositive=${this.config.firstActionMustBePositive}`
    );
  }

  /**
   * Вспомогательное: из значения стойки (0..9) получить состояние бусин:
   * {
   *   topActive: boolean,
   *   bottomActive: number  // 0..4
   * }
   */
  decodeState(value) {
    const topActive = value >= 5;
    const bottomActive = topActive ? value - 5 : value;
    return {
      topActive,
      bottomActive // 0..4
    };
  }

  /**
   * Обратно: из состояния бусин в число 0..9
   */
  encodeState({ topActive, bottomActive }) {
    return (topActive ? 5 : 0) + bottomActive;
  }

  /**
   * Проверка: можно ли сделать ПРЯМО из v в v2 одним физическим жестом
   * без "переноса через 5".
   *
   * direction = +1 или -1
   *
   * Возвращает {ok:boolean, delta:number}:
   *   ok=false → переход невозможен одним жестом
   *   ok=true  → delta = v2 - v  (например +3, -7 и т.д.)
   */
  isOneGestureTransition(v, v2, direction) {
    // базовые проверки
    if (!Number.isInteger(v) || !Number.isInteger(v2)) {
      return { ok: false, delta: 0 };
    }
    if (v2 < 0 || v2 > 9) {
      return { ok: false, delta: 0 };
    }
    const delta = v2 - v;
    if (delta === 0) {
      return { ok: false, delta: 0 };
    }
    // знак должен совпадать с direction
    if (direction > 0 && delta <= 0) return { ok: false, delta };
    if (direction < 0 && delta >= 0) return { ok: false, delta };

    const s1 = this.decodeState(v);
    const s2 = this.decodeState(v2);

    const topBefore = s1.topActive ? 1 : 0;
    const topAfter = s2.topActive ? 1 : 0;
    const botBefore = s1.bottomActive;
    const botAfter = s2.bottomActive;

    const topChange = topAfter - topBefore; // -1,0,+1
    const botChange = botAfter - botBefore; // -4..+4

    // нельзя менять одинаковую бусину дважды в одном шаге,
    // т.е. topChange ∈ {-1,0,+1}, bottomChange может быть любым
    // в допустимых пределах; это уже так.

    // Правила для положительного жеста (direction = +1):
    if (direction > 0) {
      // нельзя выключать что-то при "плюсе"
      if (topChange < 0) return { ok: false, delta };
      if (botChange < 0) return { ok: false, delta };

      // Кандидаты (+1..+9) которые соответствуют "одному жесту":
      // - только нижние: topChange=0, botChange = k>0
      //   (поднял k нижних за один жест)
      // - только верхняя: topChange=+1, botChange=0
      // - верхняя + k нижних одним жестом:
      //   topChange=+1, botChange = k>0
      //
      // НО запрещаем "перенос через 5": пример (4 -> 6).
      // 4 -> 6: before = {top:0,bottom:4}, after={top:1,bottom:1}
      //   topChange=+1, botChange=-3 (!) => ботЧейндж <0 → это ломает правило.
      //
      // То есть проверка botChange>=0 уже отсекает перенос.
      //
      // Дополнительно ограничиваем максимумы физикой:
      //   - нижних не больше 4 вообще
      //   - если поднимаем верхнюю (topChange=+1),
      //     мы можем одновременно поднять до (4 - botBefore) нижних.
      //
      if (botAfter > 4 || botBefore > 4) return { ok: false, delta };

      if (topChange === 0) {
        // чисто нижние бусины
        if (botChange <= 0) return { ok: false, delta };
        // пример: 0->3 (botChange=+3) ок
        // пример: 3->4 (botChange=+1) ок
        // Нельзя 4->? (уже все нижние активны)
        return { ok: true, delta };
      }

      if (topChange === +1) {
        // верхняя активируется
        if (s1.topActive) return { ok: false, delta }; // уже активна? нельзя "повторно"
        // botChange может быть 0..(4-botBefore)
        if (botChange < 0) return { ok: false, delta };
        if (botAfter > 4) return { ok: false, delta };
        // пример: 0->5 (top +0 bottom) delta=+5 ✔
        //         0->6 (top +1 bottom +1) delta=+6 ✔
        //         0->7 (top +1 bottom +2) delta=+7 ✔
        //         2->8 (before: top=0,b=2 -> after: top=1,b=3: +5+1=+6? нет: that's 2->8 = +6? wait 8-2=6 okay)
        // всё валидно если ботНеубывает и не больше 4
        return { ok: true, delta };
      }

      // topChange > +1 невозможно физически
      return { ok: false, delta };
    }

    // Правила для отрицательного жеста (direction = -1):
    if (direction < 0) {
      // Нельзя что-то активировать при минусе
      if (topChange > 0) return { ok: false, delta };
      if (botChange > 0) return { ok: false, delta };

      // Кандидаты (-1..-9):
      // - только нижние вниз: topChange=0, botChange = -k  (k>0)
      // - только верхняя вниз: topChange=-1, botChange=0
      // - верхняя + k нижних вниз одновременно:
      //   topChange=-1, botChange=-k (k>0)
      //
      // Аналогично перенос через 5 в минус запрещён,
      // но он бы дал botChange>0, что мы уже отсекли.

      if (botAfter < 0 || botBefore < 0) return { ok: false, delta };

      if (topChange === 0) {
        // чисто убираем нижние
        if (botChange >= 0) return { ok: false, delta };
        // не можем убирать нижние если их нет
        if (botBefore <= 0) return { ok: false, delta };
        return { ok: true, delta };
      }

      if (topChange === -1) {
        // верхнюю снимаем
        if (!s1.topActive) return { ok: false, delta }; // она должна быть активна до
        // botChange может быть 0 или отрицательный
        if (botChange > 0) return { ok: false, delta };
        if (botAfter < 0) return { ok: false, delta };
        // пример: 8 -> 2: before top=1,b=3  after top=0,b=2
        //   topChange=-1, botChange=-1, delta=-6 ✔
        return { ok: true, delta };
      }

      return { ok: false, delta };
    }

    // если направление странное
    return { ok: false, delta };
  }

  /**
   * Получить допустимые ЖЕСТЫ из текущего состояния.
   *
   * currentState = текущее значение стойки (0..9)
   * isFirstAction = это первый шаг примера?
   * position      = для будущей многоразрядности (игнорируем тут)
   *
   * Возвращаем массив действий:
   *   - если digitCount === 1 → просто числа [+3, -1, ...]
   *   - если digitCount > 1  → объекты { position, value }
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      selectedDigits,
      minState,
      maxState,
      digitCount,
      onlyAddition,
      onlySubtraction,
      includeFive
    } = this.config;

    // Берём текущую цифру разряда
    const v = this.getDigitValue(currentState, position);

    const possibleDeltas = new Set();

    // Проверяем два направления: +1 и -1
    // Но если это первый шаг, минус запрещён методикой.
    const directionsToCheck = [];
    if (!onlySubtraction) {
      directionsToCheck.push(+1);
    }
    if (!onlyAddition && !isFirstAction) {
      directionsToCheck.push(-1);
    }

    for (const direction of directionsToCheck) {
      // Генерируем все потенциальные целевые состояния v2
      // в диапазоне [0..9]
      for (let v2 = minState; v2 <= maxState; v2++) {
        const { ok, delta } = this.isOneGestureTransition(
          v,
          v2,
          direction
        );
        if (!ok) continue;

        const absDelta = Math.abs(delta);

        // 1) Шаг по модулю должен быть разрешён настройками "Просто"
        if (!selectedDigits.includes(absDelta)) continue;

        // 2) Если includeFive=false, то нельзя использовать жесты с верхней бусиной.
        //    Это значит: в этом переходе нельзя менять состояние верхней бусины.
        if (!includeFive) {
          const s1 = this.decodeState(v);
          const s2 = this.decodeState(v2);
          if (s1.topActive !== s2.topActive) {
            // верхняя изменилась -> запрещено
            continue;
          }
        }

        // Если всё прошло — добавляем дельту
        possibleDeltas.add(delta);
      }
    }

    // Превращаем множество в массив
    const deltasArray = Array.from(possibleDeltas);

    // Многозначный случай пока не используем по-настоящему,
    // но формально поддерживаем формат {position,value}
    if (digitCount > 1) {
      return deltasArray.map(value => ({ position, value }));
    }

    // Лог для отладки
    const stateStr = Array.isArray(currentState)
      ? `[${currentState.join(", ")}]`
      : currentState;
    console.log(
      `⚙️ getAvailableActions(): state=${stateStr}, first=${isFirstAction} → [${deltasArray.join(
        ", "
      )}]`
    );

    return deltasArray;
  }

  /**
   * Сколько шагов нужно в примере (рандом в мин..макс)
   */
  generateStepsCount() {
    const min = this.config.minSteps ?? 2;
    const max = this.config.maxSteps ?? min;
    if (min === max) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  /**
   * Начальное состояние: для одного разряда это 0,
   * для N разрядов — массив нулей.
   */
  generateStartState() {
    const dc = this.config.digitCount ?? 1;
    if (dc === 1) return 0;
    return Array(dc).fill(0);
  }

  /**
   * Удобное форматирование шага для UI, напр. +3 / -7
   */
  formatAction(action) {
    if (typeof action === "object" && action !== null) {
      const v = action.value;
      return v >= 0 ? `+${v}` : `${v}`;
    }
    return action >= 0 ? `+${action}` : `${action}`;
  }

  /**
   * stateToNumber:
   * - если состояние одно число → вернуть его
   * - если массив разрядов → склеить как десятичное число
   *   [единицы,десятки,...] => digits[index]*10^index
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
   * Проверка валидности состояния (каждый разряд 0..9)
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
   * Применить действие к состоянию
   * (одноразрядный случай: просто v + delta)
   */
  applyAction(currentState, action) {
    if (typeof action === "object" && action !== null) {
      // многоразрядный случай
      const arr = Array.isArray(currentState)
        ? [...currentState]
        : [currentState];
      const { position, value } = action;
      arr[position] = (arr[position] ?? 0) + value;
      return arr;
    } else {
      // одиночный разряд
      const v = Array.isArray(currentState)
        ? currentState[0] ?? 0
        : currentState ?? 0;
      return v + action;
    }
  }

  /**
   * Финальная валидация готового примера:
   * - старт = 0
   * - первый шаг >0
   * - не вылетели за 0..9
   * - финальный ответ совпадает с покроковым применением шагов
   * - если один разряд:
   *    ответ ∈ {0} ∪ selectedDigits
   */
  validateExample(example) {
    const { start, steps, answer } = example;
    const {
      digitCount,
      selectedDigits,
      minState,
      maxState
    } = this.config;

    // Старт должен быть ноль
    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Старт ${startNum} ≠ 0`);
      return false;
    }

    // Первый шаг должен быть плюсовым
    if (steps.length > 0) {
      const firstA = steps[0].action;
      const firstVal =
        typeof firstA === "object" ? firstA.value : firstA;
      if (firstVal <= 0) {
        console.error(
          `❌ Первый шаг ${firstVal} не положительный`
        );
        return false;
      }
    }

    // Все промежуточные состояния в допустимых границах
    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        console.error(
          `❌ Состояние ${JSON.stringify(
            step.toState
          )} вне диапазона ${minState}..${maxState}`
        );
        return false;
      }
    }

    // Пересчёт арифметики
    let calc = start;
    for (const step of steps) {
      calc = this.applyAction(calc, step.action);
    }
    const calcNum = this.stateToNumber(calc);
    const ansNum = this.stateToNumber(answer);
    if (calcNum !== ansNum) {
      console.error(
        `❌ Пересчёт ${calcNum} ≠ заявленному answer ${ansNum}`
      );
      return false;
    }

    // Требование к финальному ответу в одном разряде:
    // ответ должен быть либо 0, либо одной из выбранных цифр
    if (digitCount === 1) {
      const allowedFinals = new Set([0, ...selectedDigits]);
      if (!allowedFinals.has(ansNum)) {
        console.error(
          `❌ Финал ${ansNum} не входит в {0, ${selectedDigits.join(
            ", "
          )}}`
        );
        return false;
      }
    } else {
      // для нескольких разрядов просто проверяем валидность
      if (!this.isValidState(answer)) {
        console.error(
          `❌ Финал ${JSON.stringify(
            answer
          )} вне диапазона ${minState}..${maxState}`
        );
        return false;
      }
    }

    console.log(
      `✅ Пример валиден (${this.name}): финал=${ansNum}`
    );
    return true;
  }
}
