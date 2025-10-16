// ext/components/ExampleView.js - Отображение примера (столбиком/в строку)

/**
 * ExampleView - компонент для рендеринга математического примера
 * Поддерживает два режима: столбик (по умолчанию) и строка
 */
export class ExampleView {
  constructor(container) {
    this.container = container;
    this.displayMode = 'column'; // 'column' | 'inline'
  }

  /**
   * Установка режима отображения
   * @param {string} mode - 'column' или 'inline'
   */
  setDisplayMode(mode) {
    if (mode === 'column' || mode === 'inline') {
      this.displayMode = mode;
    }
  }

  /**
   * Рендер примера (массив строк типа "+2", "-5")
   * @param {Array<string>} steps - Массив шагов примера
   * @param {string} mode - Режим отображения (опционально)
   */
  render(steps, mode = null) {
    if (mode) {
      this.setDisplayMode(mode);
    }

    // Очищаем контейнер
    this.container.innerHTML = '';
    this.container.className = `example-view example--${this.displayMode}`;

    if (this.displayMode === 'column') {
      this.renderColumn(steps);
    } else {
      this.renderInline(steps);
    }

    // Автомасштабирование шрифта
    this.adjustFontSize(steps.length);
  }

  /**
   * Рендер в столбик (каждый шаг на новой строке)
   * @param {Array<string>} steps
   */
  renderColumn(steps) {
    steps.forEach(step => {
      const line = document.createElement('div');
      line.className = 'example__line';
      line.textContent = step;
      this.container.appendChild(line);
    });
  }

  /**
   * Рендер в строку (все шаги в одной строке с переносом)
   * @param {Array<string>} steps
   */
  renderInline(steps) {
    const line = document.createElement('div');
    line.className = 'example__line example__line--inline';
    line.textContent = steps.join(' ');
    this.container.appendChild(line);
  }

  /**
   * Автоматическое масштабирование шрифта
   * Формула из плана: fontSize = clamp(24px, (vh * 0.75) / (lines + 2), 72px)
   * @param {number} lineCount - Количество строк
   */
  adjustFontSize(lineCount) {
    const lines = this.container.querySelectorAll('.example__line');
    if (!lines.length) return;

    const vh = window.innerHeight;
    const clampedLines = Math.min(lineCount, 15); // максимум 15 строк видимых

    // Формула из плана
    const calculatedSize = (vh * 0.75) / (clampedLines + 2);
    const fontSize = Math.max(24, Math.min(72, calculatedSize));

    lines.forEach(line => {
      line.style.fontSize = `${fontSize}px`;
    });

    console.log(`📏 Размер шрифта: ${fontSize.toFixed(0)}px (для ${clampedLines} строк)`);
  }

  /**
   * Пошаговый показ (для длинных цепочек N > 15 или ∞)
   * @param {Array<string>} steps - Все шаги примера
   * @param {number} speed - Скорость показа в миллисекундах
   * @param {Function} onComplete - Колбэк после завершения показа
   */
  renderStepByStep(steps, speed = 1000, onComplete = null) {
    this.container.innerHTML = '';
    this.container.className = `example-view example--${this.displayMode}`;

    let currentStep = 0;

    const showNextStep = () => {
      if (currentStep >= steps.length) {
        if (onComplete) {
          onComplete();
        }
        return;
      }

      // Добавляем новую строку
      if (this.displayMode === 'column') {
        const line = document.createElement('div');
        line.className = 'example__line';
        line.textContent = steps[currentStep];
        this.container.appendChild(line);
      } else {
        // В режиме "строка" обновляем единственную строку
        let line = this.container.querySelector('.example__line');
        if (!line) {
          line = document.createElement('div');
          line.className = 'example__line example__line--inline';
          this.container.appendChild(line);
        }
        const currentText = line.textContent;
        line.textContent = currentText ? `${currentText} ${steps[currentStep]}` : steps[currentStep];
      }

      // Пересчитываем размер шрифта
      this.adjustFontSize(currentStep + 1);

      currentStep++;

      // Запускаем таймер для следующего шага
      setTimeout(showNextStep, speed);
    };

    // Запускаем показ
    showNextStep();
  }

  /**
   * Очистка контейнера
   */
  clear() {
    this.container.innerHTML = '';
  }
}
