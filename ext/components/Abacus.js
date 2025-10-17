// ext/components/Abacus.js - Интерактивный соробан с Drag & Drop

/**
 * Abacus - компонент интерактивного абакуса (соробана)
 * Структура: каждая стойка имеет 1 верхнюю бусину (Heaven, 5) и 4 нижние (Earth, 1+1+1+1)
 * Формула значения: S = 5 * U + L, где U = верхняя (0 или 1), L = нижние (0-4)
 */
export class Abacus {
  /**
   * @param {HTMLElement} container - Контейнер для монтирования
   * @param {number} digits - Разрядность (количество стоек = digits + 1)
   */
  constructor(container, digits = 1) {
    this.container = container;
    this.digits = digits;
    this.columns = digits + 1; // ВАЖНО: всегда на 1 больше разрядности!
    
    // Состояние каждой стойки: { upper: 0|1, lower: 0-4 }
    this.state = Array.from({ length: this.columns }, () => ({
      upper: 0, // 0 = внизу (не активна), 1 = вверху (активна)
      lower: 0  // 0-4 бусины снизу активны
    }));
    
    // НОВОЕ: Состояние перетаскивания
    this.dragState = {
      active: false,
      beadElement: null,
      columnIndex: null,
      beadType: null, // 'upper' или 'lower'
      beadIndex: null, // для lower бусин (0-3)
      startY: 0,
      initialTransform: 0
    };
    
    // Привязываем методы к контексту (для removeEventListener)
    this.onDrag = this.onDrag.bind(this);
    this.stopDrag = this.stopDrag.bind(this);
    
    this.render();
  }
  
  /**
   * Рендеринг абакуса
   */
  render() {
    this.container.innerHTML = '';
    this.container.className = 'abacus';
    
    // Создаём стойки
    for (let colIndex = 0; colIndex < this.columns; colIndex++) {
      const column = this.createColumn(colIndex);
      this.container.appendChild(column);
    }
    
    console.log(`🧮 Абакус отрендерен: ${this.columns} стоек (разрядность ${this.digits})`);
  }
  
  /**
   * Создание одной стойки
   * @param {number} colIndex - Индекс стойки
   * @returns {HTMLElement}
   */
  createColumn(colIndex) {
    const col = document.createElement('div');
    col.className = 'abacus__column';
    col.dataset.col = colIndex;
    
    // Верхняя часть (Heaven bead)
    const upperSection = document.createElement('div');
    upperSection.className = 'abacus__upper';
    
    const upperBead = document.createElement('div');
    upperBead.className = 'bead bead--upper';
    upperBead.dataset.col = colIndex;
    upperBead.dataset.type = 'upper';
    upperBead.textContent = '5';
    upperBead.style.transition = 'transform 0.3s linear'; // НОВОЕ: плавность
    
    if (this.state[colIndex].upper === 1) {
      upperBead.classList.add('bead--engaged');
    }
    
    // НОВОЕ: Drag & Drop вместо клика
    this.attachDragHandlers(upperBead, colIndex, 'upper', null);
    
    upperSection.appendChild(upperBead);
    
    // Разделитель (bar)
    const bar = document.createElement('div');
    bar.className = 'abacus__bar';
    
    // Нижняя часть (Earth beads)
    const lowerSection = document.createElement('div');
    lowerSection.className = 'abacus__lower';
    
    for (let i = 0; i < 4; i++) {
      const lowerBead = document.createElement('div');
      lowerBead.className = 'bead bead--lower';
      lowerBead.dataset.col = colIndex;
      lowerBead.dataset.index = i;
      lowerBead.textContent = '1';
      lowerBead.style.transition = 'transform 0.3s linear'; // НОВОЕ: плавность
      
      // Проверяем, активна ли эта бусина
      if (i < this.state[colIndex].lower) {
        lowerBead.classList.add('bead--engaged');
      }
      
      // НОВОЕ: Drag & Drop вместо клика
      this.attachDragHandlers(lowerBead, colIndex, 'lower', i);
      
      lowerSection.appendChild(lowerBead);
    }
    
    col.append(upperSection, bar, lowerSection);
    return col;
  }
  
  /**
   * Привязка drag & drop обработчиков к бусине
   * @param {HTMLElement} beadElement - DOM элемент бусины
   * @param {number} colIndex - Индекс колонки
   * @param {string} beadType - 'upper' или 'lower'
   * @param {number|null} beadIndex - Индекс для lower бусин (0-3)
   */
  attachDragHandlers(beadElement, colIndex, beadType, beadIndex) {
    // Мышь: начало перетаскивания
    beadElement.addEventListener('mousedown', (e) => {
      this.startDrag(e, beadElement, colIndex, beadType, beadIndex);
    });
    
    // Touch: начало перетаскивания
    beadElement.addEventListener('touchstart', (e) => {
      this.startDrag(e, beadElement, colIndex, beadType, beadIndex);
    });
    
    // Предотвращаем выделение текста
    beadElement.addEventListener('selectstart', (e) => e.preventDefault());
  }
  
  /**
   * Начало перетаскивания
   */
  startDrag(event, beadElement, colIndex, beadType, beadIndex) {
    event.preventDefault();
    
    // Определяем начальную Y-координату
    const clientY = event.type.includes('touch') 
      ? event.touches[0].clientY 
      : event.clientY;
    
    // Получаем текущий transform
    const style = window.getComputedStyle(beadElement);
    const matrix = new DOMMatrix(style.transform);
    const currentTransformY = matrix.m42; // translateY value
    
    this.dragState = {
      active: true,
      beadElement,
      columnIndex: colIndex,
      beadType,
      beadIndex,
      startY: clientY,
      initialTransform: currentTransformY
    };
    
    // Убираем transition на время перетаскивания
    beadElement.style.transition = 'none';
    
    // Добавляем визуальный feedback
    beadElement.style.cursor = 'grabbing';
    beadElement.style.zIndex = '10';
    
    // Привязываем глобальные обработчики
    document.addEventListener('mousemove', this.onDrag);
    document.addEventListener('mouseup', this.stopDrag);
    document.addEventListener('touchmove', this.onDrag);
    document.addEventListener('touchend', this.stopDrag);
    
    console.log(`🧮 Начало drag: колонка ${colIndex}, тип ${beadType}`);
  }
  
  /**
   * Процесс перетаскивания
   */
  onDrag(event) {
    if (!this.dragState.active) return;
    
    const clientY = event.type.includes('touch') 
      ? event.touches[0].clientY 
      : event.clientY;
    
    const deltaY = clientY - this.dragState.startY;
    const newTransform = this.dragState.initialTransform + deltaY;
    
    // Ограничиваем движение по оси Y
    const { beadType } = this.dragState;
    let clampedTransform;
    
    if (beadType === 'upper') {
      // Верхняя бусина: от 0 (вверху) до 50px (внизу у bar)
      clampedTransform = Math.max(0, Math.min(50, newTransform));
    } else {
      // Нижние бусины: от -40px (вверху у bar) до 0 (внизу)
      clampedTransform = Math.max(-40, Math.min(0, newTransform));
    }
    
    // Применяем transform
    this.dragState.beadElement.style.transform = `translateY(${clampedTransform}px)`;
  }
  
  /**
   * Окончание перетаскивания
   */
  stopDrag(event) {
    if (!this.dragState.active) return;
    
    const { beadElement, columnIndex, beadType, beadIndex } = this.dragState;
    
    // Получаем финальную позицию
    const style = window.getComputedStyle(beadElement);
    const matrix = new DOMMatrix(style.transform);
    const finalTransformY = matrix.m42;
    
    // Возвращаем transition
    beadElement.style.transition = 'transform 0.3s linear';
    beadElement.style.cursor = 'grab';
    beadElement.style.zIndex = '';
    
    // Определяем новое состояние на основе позиции
    if (beadType === 'upper') {
      // Если бусина ниже 25px (середина) → engaged (1), иначе → 0
      const shouldEngage = finalTransformY > 25;
      this.state[columnIndex].upper = shouldEngage ? 1 : 0;
    } else {
      // Для нижних бусин: если выше -20px → engaged
      const shouldEngage = finalTransformY < -20;
      
      if (shouldEngage) {
        // Активируем все бусины до этой включительно
        this.state[columnIndex].lower = beadIndex + 1;
      } else {
        // Деактивируем все бусины после этой
        this.state[columnIndex].lower = Math.min(this.state[columnIndex].lower, beadIndex);
      }
    }
    
    // Обновляем колонку
    this.updateColumn(columnIndex);
    
    // Сбрасываем drag state
    this.dragState.active = false;
    
    // Убираем глобальные обработчики
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('mouseup', this.stopDrag);
    document.removeEventListener('touchmove', this.onDrag);
    document.removeEventListener('touchend', this.stopDrag);
    
    console.log(`🧮 Конец drag: колонка ${columnIndex}, значение = ${this.getColumnValue(columnIndex)}`);
  }
  
  /**
   * Обновление визуала одной стойки
   * @param {number} colIndex
   */
  updateColumn(colIndex) {
    const column = this.container.querySelector(`.abacus__column[data-col="${colIndex}"]`);
    if (!column) return;
    
    // Обновляем верхнюю бусину
    const upperBead = column.querySelector('.bead--upper');
    if (this.state[colIndex].upper === 1) {
      upperBead.classList.add('bead--engaged');
      upperBead.style.transform = 'translateY(50px)';
    } else {
      upperBead.classList.remove('bead--engaged');
      upperBead.style.transform = 'translateY(0)';
    }
    
    // Обновляем нижние бусины
    const lowerBeads = column.querySelectorAll('.bead--lower');
    lowerBeads.forEach((bead, index) => {
      if (index < this.state[colIndex].lower) {
        bead.classList.add('bead--engaged');
        bead.style.transform = 'translateY(-8px)';
      } else {
        bead.classList.remove('bead--engaged');
        bead.style.transform = 'translateY(0)';
      }
    });
  }
  
  /**
   * Получить значение стойки (S = 5*U + L)
   * @param {number} colIndex
   * @returns {number}
   */
  getColumnValue(colIndex) {
    const { upper, lower } = this.state[colIndex];
    return 5 * upper + lower;
  }
  
  /**
   * Получить полное число с абакуса (читаем справа налево)
   * @returns {number}
   */
  getValue() {
    let result = 0;
    for (let i = 0; i < this.columns; i++) {
      const power = this.columns - 1 - i; // позиция разряда
      result += this.getColumnValue(i) * Math.pow(10, power);
    }
    return result;
  }
  
  /**
   * Установить значение на абакусе
   * @param {number} value - Число для отображения
   */
  setValue(value) {
    const digits = String(value).padStart(this.columns, '0').split('');
    
    digits.forEach((digit, index) => {
      const num = parseInt(digit, 10);
      
      // Раскладываем на 5*U + L
      if (num >= 5) {
        this.state[index].upper = 1;
        this.state[index].lower = num - 5;
      } else {
        this.state[index].upper = 0;
        this.state[index].lower = num;
      }
      
      this.updateColumn(index);
    });
    
    console.log(`🧮 Установлено значение: ${value}`);
  }
  
  /**
   * Сброс абакуса (все бусины в исходное положение)
   */
  reset() {
    this.state.forEach((col, index) => {
      col.upper = 0;
      col.lower = 0;
      this.updateColumn(index);
    });
    console.log('🧮 Абакус сброшен');
  }
}
