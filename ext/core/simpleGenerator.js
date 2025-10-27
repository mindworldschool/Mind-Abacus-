// ext/core/simpleGenerator.js
// Генератор примеров для блока "Просто"
// Логика: стартуем с 0, первый шаг всегда +, далее +/- разрешённых чисел, но не выходим за 0..9

/**
 * Взять случайный элемент массива
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Проверяем, можно ли сделать шаг stepAmount из currentValue,
 * так чтобы не уйти за диапазон 0..9
 */
function isStepAllowed(currentValue, stepAmount) {
  const next = currentValue + stepAmount;
  return next >= 0 && next <= 9;
}

/**
 * Получить список всех возможных шагов (и плюсы, и минусы)
 * из текущего состояния currentValue,
 * учитывая разрешённые цифры allowedDigits (например [1,2,3,4,5,6,7,8,9])
 *
 * ВАЖНО:
 *  - Первый шаг мы обрабатываем отдельно (он всегда плюс).
 *  - Начиная со второго шага можно как +d так и -d.
 */
function getAllPossibleSteps(currentValue, allowedDigits) {
  const moves = [];

  for (const d of allowedDigits) {
    const plus = +d;
    const minus = -d;

    // попробуем +d
    if (isStepAllowed(currentValue, plus)) {
      moves.push(plus);
    }
    // попробуем -d
    if (isStepAllowed(currentValue, minus)) {
      // минус допустим, только если реально есть что снимать (currentValue >= d)
      // но isStepAllowed это уже гарантирует, т.к. currentValue - d >=0
      moves.push(minus);
    }
  }

  // Убираем дубликаты (на случай странных повторов)
  return Array.from(new Set(moves));
}

/**
 * Сгенерировать ОДИН пример для режима "Просто"
 *
 * @param {number[]} allowedDigits - список разрешённых чисел (например [1,2,3,4,5,6,7,8,9]
 *                                   или [2] или [3,7])
 * @param {number} stepsCount - желаемое количество шагов в примере.
 *                              Это сколько операций (+3, -7, +6, ...) ребёнок увидит.
 *                              Пример: 4, 5, 6.
 *
 * Возвращает объект формата:
 * {
 *   start: 0,
 *   steps: [ +3, +1, +5, -7, +6, -8 ],
 *   answer: 0
 * }
 */
export function generateSimpleExample(allowedDigits, stepsCount = 4) {
  // 1. стартовое состояние абакуса — 0
  let currentValue = 0;
  const steps = [];

  // sanity: отфильтровать мусор
  const uniqueDigits = Array.from(
    new Set(
      allowedDigits
        .map(d => parseInt(d, 10))
        .filter(d => Number.isFinite(d) && d >= 1 && d <= 9)
    )
  );
  if (uniqueDigits.length === 0) {
    throw new Error("[generateSimpleExample] allowedDigits пустой или некорректный");
  }

  // 2. первый шаг: всегда положительный
  //    выбираем любую разрешённую цифру d, если 0 + d <= 9 (всегда true для d<=9)
  //    => но технически, если кто-то в настройках дал >9 (не должно быть),
  //       мы уже отфильтровали.
  const firstCandidates = uniqueDigits.filter(d => isStepAllowed(currentValue, +d));
  if (firstCandidates.length === 0) {
    throw new Error("[generateSimpleExample] нет допустимых первых шагов");
  }

  const firstDigit = pickRandom(firstCandidates);
  steps.push(+firstDigit);
  currentValue += firstDigit;

  // 3. остальные шаги
  //    каждый шаг мы берём из всех возможных +/-d,
  //    но следим, что мы не улетаем за 0..9
  while (steps.length < stepsCount) {
    const possibleMoves = getAllPossibleSteps(currentValue, uniqueDigits);

    // защита от тупика: если дальше некуда ходить, просто стопаемся
    if (!possibleMoves.length) break;

    const move = pickRandom(possibleMoves);

    steps.push(move);
    currentValue += move;
  }

  return {
    start: 0,
    steps,          // массив чисел со знаками, например [+3, +1, +5, -7, +6, -8]
    answer: currentValue // конечное значение после всех шагов
  };
}
