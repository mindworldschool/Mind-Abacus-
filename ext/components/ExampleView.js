// ext/components/ExampleView.js - Отображение примера (столбиком/в строку)

/**
 * ExampleView - компонент для рендеринга математического примера
 * Поддерживает два режима: столбик (по умолчанию) и строка
 * Совместим с новым форматом steps = ["+3", "-1", "+5", ...]
 */
export class ExampleView {
  constructor(container) {
    this.container = container;
    this.displayMode = "column"; // "column" | "inline"
  }

  /**
   * Установка режима отображения
   * @param {string} mode - 'column' или 'inline'
   */
  setDisplayMode(mode) {
    if (mode === "column" || mode === "inline") {
      this.displayMode = mode;
    }
  }

  /**
   * Рендер примера (массив строк типа "+2", "-5")
   * @param {Array<string>|string} steps - массив шагов или строка
   * @param {string} mode - режим отображения (опционально)
   */
  render(steps, mode = null) {
    if (mode) {
      this.setDisplayMode(mode);
    }

    // Очищаем контейнер
    this.container.innerHTML = "";
    this.container.className = `example-view example--${this.displayMode}`;

    // Универсальность: поддерживаем и старый формат (expr = "+3 +1 -2")
    let stepsArray = [];
    if (Array.isArray(steps)) {
      stepsArray = steps;
    } else if (typeof steps === "string") {
      stepsArray = steps.trim().split(/\s+/);
    } else {
      console.warn("⚠️ ExampleView: неверный формат steps:", steps);
      return;
    }

    if (this.displayMode === "column") {
      this.renderColumn(stepsArray);
    } else {
      this.renderInline(stepsArray);
    }
  }

  /**
   * Рендер в столбик (каждый шаг на новой строке)
   * @param {Array<string>} steps
   */
  renderColumn(steps) {
    for (const step of steps) {
      const line = document.createElement("div");
      line.className = "example__line";
      line.textContent = step;
      this.container.appendChild(line);
    }
  }

  /**
   * Рендер в строку (все шаги одной линией)
   * @param {Array<string>} steps
   */
  renderInline(steps) {
    const line = document.createElement("div");
    line.className = "example__line example__line--inline";
    line.textContent = steps.join(" ");
    this.container.appendChild(line);
  }

  /**
   * Автоматическое масштабирование шрифта
   * (используется trainer_logic.js, здесь только запасной вариант)
   * @param {number} lineCount
   */
  adjustFontSize(lineCount) {
    const lines = this.container.querySelectorAll(".example__line");
    if (!lines.length) return;

    const vh = window.innerHeight;
    const clampedLines = Math.min(lineCount, 15);
    const calculatedSize = (vh * 0.75) / (clampedLines + 2);
    const fontSize = Math.max(24, Math.min(72, calculatedSize));

    for (const line of lines) {
      line.style.fontSize = `${fontSize}px`;
    }

    console.log(`📏 Font: ${fontSize.toFixed(0)}px (${clampedLines} строк)`);
  }

  /**
   * Пошаговый показ (для диктовки или длинных цепочек)
   * @param {Array<string>} steps
   * @param {number} speed - интервал в мс
   * @param {Function} onComplete - callback после показа
   */
  renderStepByStep(steps, speed = 1000, onComplete = null) {
    this.container.innerHTML = "";
    this.container.className = `example-view example--${this.displayMode}`;

    let index = 0;
    const stepsArray = Array.isArray(steps)
      ? steps
      : String(steps).trim().split(/\s+/);

    const showNext = () => {
      if (index >= stepsArray.length) {
        if (onComplete) onComplete();
        return;
      }

      if (this.displayMode === "column") {
        const line = document.createElement("div");
        line.className = "example__line";
        line.textContent = stepsArray[index];
        this.container.appendChild(line);
      } else {
        let line =
          this.container.querySelector(".example__line") ||
          (() => {
            const el = document.createElement("div");
            el.className = "example__line example__line--inline";
            this.container.appendChild(el);
            return el;
          })();
        line.textContent = line.textContent
          ? `${line.textContent} ${stepsArray[index]}`
          : stepsArray[index];
      }

      index++;
      setTimeout(showNext, speed);
    };

    showNext();
  }

  /**
   * Очистка контейнера
   */
  clear() {
    this.container.innerHTML = "";
  }
}
