// ext/core/rules/UnifiedSimpleRule.js
// Унифицированное правило для тренировки "Просто"
// Поддерживает:
// - режим "Просто 4" (без верхней косточки),
// - режим "Просто 5" (с верхней косточкой),
// - многоразрядные числа,
// - ограничения по направлению (только плюс / только минус),
// - требование, что первый шаг не может быть минусом,
// - отсутствие переноса между столбцами (никаких переходов через 10).

import { BaseRule } from "./BaseRule.js";

export class UnifiedSimpleRule extends BaseRule {
  constructor(config = {}) {
    super(config);

    const selectedDigits = config.selectedDigits || [1, 2, 3, 4];

    const includeFive =
      (config.includeFive ??
        config.blocks?.simple?.includeFive ??
        selectedDigits.includes(5)) === true;

    const hasFive = includeFive;

    this.name = hasFive ? "Просто с 5" : "Просто";
    this.description = hasFive
      ? "Работа с нижними и верхней косточкой (0–9)"
      : "Работа только с нижними косточками (0–4)";

    this.config = {
      minState: 0,
      maxState: hasFive ? 9 : 4,
      maxFinalState: hasFive ? 5 : 4,
      minSteps: config.minSteps ?? 2,
      maxSteps: config.maxSteps ?? 4,
      selectedDigits,
      hasFive,
      includeFive: hasFive,
      onlyFiveSelected: config.onlyFiveSelected || false,
      firstActionMustBePositive: true,
      digitCount: config.digitCount ?? 1,
      combineLevels: config.combineLevels ?? false,
      onlyAddition: config.onlyAddition ?? false,
      onlySubtraction: config.onlySubtraction ?? false,
      brothersActive: config.brothersActive ?? false,
      friendsActive: config.friendsActive ?? false,
      mixActive: config.mixActive ?? false,
      ...config
    };

    console.log(
      `✅ UnifiedSimpleRule создано: ${this.name}
  digitsAllowed=[${selectedDigits.join(", ")}]
  digitCount=${this.config.digitCount}
  combineLevels=${this.config.combineLevels}
  includeFive=${this.config.includeFive}
  onlyAddition=${this.config.onlyAddition}
  onlySubtraction=${this.config.onlySubtraction}`
    );
  }

  /**
   * Обновлённая логика v2:
   * - запрещены переходы вроде 4→7 ("+3") — нельзя убирать нижние и включать верхнюю в одном жесте
   * - разрешены только реальные жесты:
   *   + поднять нижние
   *   + добавить верхнюю (ровно +5)
   *   - опустить нижние
   *   - снять верхнюю (-5)
   *   - снять всё (-v)
   */
  getAvailableActions(currentState, isFirstAction = false, position = 0) {
    const {
      includeFive,
      selectedDigits,
      digitCount,
      onlyAddition,
      onlySubtraction
    } = this.config;

    const v = this.getDigitValue(currentState, position); // 0..9
    const isUpperActive = includeFive && v >= 5;
    const lowerCount = isUpperActive ? v - 5 : v; // 0..4
    const targets = new Set();

    // ===== ПЛЮСЫ =====
    if (!onlySubtraction) {
      if (!isUpperActive) {
        // нижние активны, верхняя нет
        // можно поднять нижние до 4
        for (let next = v + 1; next <= 4; next++) targets.add(next);

        // можно добавить верхнюю целиком (v+5)
        if (includeFive) {
          const next = v + 5;
          if (next <= 9) targets.add(next);
        }
      } else {
        // верхняя активна — можно добрать оставшиеся нижние
        for (let next = v + 1; next <= 9; next++) targets.add(next);
      }
    }

    // ===== МИНУСЫ =====
    if (!onlyAddition) {
      if (!isUpperActive) {
        // без верхней — можно опускать нижние
        for (let next = v - 1; next >= 0; next--) targets.add(next);
      } else {
        // с верхней
        // 1) опускать нижние, оставляя верхнюю
        for (let next = v - 1; next >= 5; next--) targets.add(next);
        // 2) снять верхнюю, оставив нижние
        targets.add(lowerCount);
        // 3) снять всё
        targets.add(0);
      }
    }

    // === Превращаем в дельты ===
    let deltas = [];
    for (const next of targets) {
      if (next === v) continue;
      const delta = next - v;
      const abs = Math.abs(delta);

      if (isFirstAction && delta < 0) continue;
      if (onlyAddition && delta < 0) continue;
      if (onlySubtraction && delta > 0) continue;
      if (!selectedDigits.includes(abs)) continue;
      if (abs === 5 && !includeFive) continue;
      if (v + delta < 0 || v + delta > 9) continue;

      deltas.push(delta);
    }

    deltas = [...new Set(deltas)];

    // === Формат вывода ===
    let result;
    if (digitCount > 1) {
      result = deltas.map(value => ({ position, value }));
    } else {
      result = deltas.slice();
    }

    console.log(
      `⚙️ getAvailableActions strict v2: v=${v} → [${result
        .map(a =>
          typeof a === "object" ? `{${a.position}:${a.value}}` : a
        )
        .join(", ")}]`
    );

    return result;
  }

  validateExample(example) {
    const { start, steps, answer } = example;
    const { maxFinalState, digitCount } = this.config;

    const startNum = this.stateToNumber(start);
    if (startNum !== 0) {
      console.error(`❌ Начальное состояние ${startNum} ≠ 0`);
      return false;
    }

    if (steps.length > 0) {
      const first = steps[0].action;
      const firstVal = typeof first === "object" ? first.value : first;
      if (firstVal <= 0) {
        console.error(`❌ Первое действие ${firstVal} не положительное`);
        return false;
      }
    }

    const answerNum = this.stateToNumber(answer);
    if (digitCount === 1) {
      if (answerNum > maxFinalState || answerNum < 0) {
        console.error(`❌ Финал ${answerNum} вне диапазона 0-${maxFinalState}`);
        return false;
      }
    } else {
      if (answerNum < 0) {
        console.error(`❌ Финал ${answerNum} отрицательный`);
        return false;
      }
    }

    for (const step of steps) {
      if (!this.isValidState(step.toState)) {
        console.error(`❌ Невалидное состояние`, step.toState);
        return false;
      }
    }

    let calc = start;
    for (const step of steps) calc = this.applyAction(calc, step.action);
    const calcNum = this.stateToNumber(calc);
    if (calcNum !== answerNum) {
      console.error(`❌ Расчёт ${calcNum} ≠ ${answerNum}`);
      return false;
    }

    console.log(`✅ Пример валиден (${this.name})`);
    return true;
  }
}
