// ext/components/AbacusNew.js - Абакус с красивой SVG графикой

/**
 * Abacus - компонент интерактивного абакуса (соробана) с SVG графикой
 * Структура: каждая стойка имеет 1 верхнюю бусину (Heaven, 5) и 4 нижние (Earth, 1+1+1+1)
 * Формула значения: S = 5 * U + L, где U = верхняя (0 или 1), L = нижние (0-4)
 */
export class Abacus {
  /**
   * @param {HTMLElement} container - Контейнер для монтирования
   * @param {Object} options - Опции { digitCount: number }
   */
  constructor(container, options = {}) {
    this.container = container;
    this.digitCount = options.digitCount || 2;
    this.columns = this.digitCount; // Количество стоек = разрядность
    
    // Состояние бусин: { heaven: 'up'|'down', earth: ['up'|'down', ...] }
    this.beads = {};
    
    // Состояние перетаскивания
    this.dragging = null;
    this.dragStartY = null;
    
    this.init();
  }
  
  /**
   * Инициализация абакуса
   */
  init() {
    // Инициализация всех бусин в исходное положение
    for (let col = 0; col < this.digitCount; col++) {
      this.beads[col] = {
        heaven: 'up', // верхняя бусина вверху (не активна)
        earth: ['down', 'down', 'down', 'down'] // нижние внизу (не активны)
      };
    }
    
    this.render();
    this.attachEventListeners();
    
    console.log(`🧮 Новый абакус отрендерен: ${this.digitCount} стоек`);
  }
  
  /**
   * Рендеринг абакуса
   */
  render() {
    const width = this.digitCount * 72 + 40;
    
    this.container.innerHTML = `
      <div class="abacus-wrapper">
        <svg id="abacus-svg" width="${width}" height="300" style="user-select: none;">
          ${this.renderDefs()}
          ${this.renderFrame()}
          ${this.renderRods()}
          ${this.renderMiddleBar()}
          ${this.renderBeads()}
        </svg>
      </div>
    `;
  }
  
  /**
   * Определения SVG (градиенты, фильтры)
   */
  renderDefs() {
    return `
      <defs>
        <!-- Тень для бусин -->
        <filter id="beadShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="0" dy="3" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.6"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <!-- Тень для рамки -->
        <filter id="frameShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
          <feOffset dx="0" dy="4" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.5"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <!-- Градиент для рамки -->
        <linearGradient id="topFrameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#A0522D" stop-opacity="1" />
          <stop offset="50%" stop-color="#8B4513" stop-opacity="1" />
          <stop offset="100%" stop-color="#6B3410" stop-opacity="1" />
        </linearGradient>
        
        <!-- Градиент для металлической планки -->
        <linearGradient id="metalBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#949494" stop-opacity="1" />
          <stop offset="30%" stop-color="#ababab" stop-opacity="1" />
          <stop offset="50%" stop-color="#757575" stop-opacity="1" />
          <stop offset="70%" stop-color="#8c8c8c" stop-opacity="1" />
          <stop offset="100%" stop-color="#606060" stop-opacity="1" />
        </linearGradient>
        
        <!-- Градиент для бусин -->
        <radialGradient id="beadGradient" cx="45%" cy="40%">
          <stop offset="0%" stop-color="#ffb366" stop-opacity="1" />
          <stop offset="50%" stop-color="#ff7c00" stop-opacity="1" />
          <stop offset="100%" stop-color="#cc6300" stop-opacity="1" />
        </radialGradient>
      </defs>
    `;
  }
  
  /**
   * Рендеринг рамки абакуса
   */
  renderFrame() {
    const width = this.digitCount * 72 + 20;
    return `
      <!-- Верхняя рамка -->
      <rect x="10" y="10" width="${width}" height="30" fill="url(#topFrameGradient)" filter="url(#frameShadow)" rx="5"/>
      <rect x="15" y="13" width="${width - 10}" height="4" fill="rgba(255, 255, 255, 0.15)" rx="2"/>
      
      <!-- Нижняя рамка -->
      <rect x="10" y="264" width="${width}" height="30" fill="url(#topFrameGradient)" filter="url(#frameShadow)" rx="5"/>
      <rect x="15" y="267" width="${width - 10}" height="4" fill="rgba(255, 255, 255, 0.15)" rx="2"/>
    `;
  }
  
  /**
   * Рендеринг стержней
   */
  renderRods() {
    let rods = '';
    for (let col = 0; col < this.digitCount; col++) {
      const x = 50 + col * 72;
      rods += `<line x1="${x}" y1="40" x2="${x}" y2="264" stroke="#654321" stroke-width="8"/>`;
    }
    return rods;
  }
  
  /**
   * Рендеринг средней разделительной планки
   */
  renderMiddleBar() {
    const width = this.digitCount * 72 + 20;
    return `
      <rect x="10" y="91" width="${width}" height="10" fill="url(#metalBarGradient)" rx="2"/>
      <rect x="15" y="92" width="${width - 10}" height="2" fill="rgba(255, 255, 255, 0.6)" rx="1"/>
      <rect x="10" y="101" width="${width}" height="2" fill="rgba(0, 0, 0, 0.3)" rx="1"/>
    `;
  }
  
  /**
   * Рендеринг всех бусин
   */
  renderBeads() {
    let beadsHTML = '';
    
    for (let col = 0; col < this.digitCount; col++) {
      const x = 50 + col * 72;
      const beadHeight = 36;
      const beadWidth = 32;
      const gapFromBar = 1;
      
      // Небесная бусина (верхняя)
      const heavenY = this.beads[col].heaven === 'down' 
        ? 91 - beadHeight/2 - gapFromBar // активна (у планки)
        : 40 + beadHeight/2 + gapFromBar; // не активна (вверху)
      
      beadsHTML += this.renderBead(x, heavenY, beadWidth, beadHeight, col, 'heaven', 0);
      
      // Земные бусины (нижние)
      const earthActive = this.beads[col].earth;
      const upCount = earthActive.filter(p => p === 'up').length;
      const downCount = 4 - upCount;
      
      for (let index = 0; index < 4; index++) {
        let earthY;
        if (earthActive[index] === 'up') {
          // Активная бусина (у планки сверху)
          const activeIndex = earthActive.slice(0, index).filter(p => p === 'up').length;
          earthY = 101 + beadHeight/2 + gapFromBar + activeIndex * beadHeight;
        } else {
          // Неактивная бусина (внизу)
          const inactiveIndex = earthActive.slice(0, index).filter(p => p === 'down').length;
          earthY = 264 - beadHeight/2 - gapFromBar - (downCount - 1 - inactiveIndex) * beadHeight;
        }
        
        beadsHTML += this.renderBead(x, earthY, beadWidth, beadHeight, col, 'earth', index);
      }
    }
    
    return beadsHTML;
  }
  
  /**
   * Рендеринг одной бусины
   */
  renderBead(x, y, width, height, col, type, index) {
    const hw = width;
    const hh = height / 2;
    const cutSize = 12;
    const sideRoundness = 2;
    
    // SVG path для формы бусины (восьмиугольник со скругленными углами)
    const path = `
      M ${x - cutSize} ${y - hh}
      L ${x + cutSize} ${y - hh}
      Q ${x + cutSize + 2} ${y - hh + 2} ${x + hw - sideRoundness} ${y - sideRoundness}
      Q ${x + hw} ${y} ${x + hw - sideRoundness} ${y + sideRoundness}
      Q ${x + cutSize + 2} ${y + hh - 2} ${x + cutSize} ${y + hh}
      L ${x - cutSize} ${y + hh}
      Q ${x - cutSize - 2} ${y + hh - 2} ${x - hw + sideRoundness} ${y + sideRoundness}
      Q ${x - hw} ${y} ${x - hw + sideRoundness} ${y - sideRoundness}
      Q ${x - cutSize - 2} ${y - hh + 2} ${x - cutSize} ${y - hh}
      Z
    `;
    
    return `
      <g class="bead" data-col="${col}" data-type="${type}" data-index="${index}" style="cursor: grab;">
        <path d="${path}" fill="url(#beadGradient)" filter="url(#beadShadow)"/>
        <line x1="${x - width}" y1="${y}" x2="${x + width}" y2="${y}" stroke="rgba(0, 0, 0, 0.075)" stroke-width="2"/>
      </g>
    `;
  }
  
  /**
   * Привязка обработчиков событий
   */
  attachEventListeners() {
    const svg = this.container.querySelector('#abacus-svg');
    if (!svg) return;
    
    // Mouse события
    svg.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', () => this.handleMouseUp());
    
    // Touch события для мобильных
    svg.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleMouseDown(e.touches[0]);
    });
    document.addEventListener('touchmove', (e) => {
      if (this.dragging) e.preventDefault();
      this.handleMouseMove(e.touches[0]);
    });
    document.addEventListener('touchend', () => this.handleMouseUp());
  }
  
  /**
   * Начало перетаскивания
   */
  handleMouseDown(e) {
    const beadGroup = e.target.closest('.bead');
    if (!beadGroup) return;
    
    const col = parseInt(beadGroup.dataset.col);
    const type = beadGroup.dataset.type;
    const index = parseInt(beadGroup.dataset.index);
    
    const rect = this.container.querySelector('#abacus-svg').getBoundingClientRect();
    this.dragStartY = e.clientY - rect.top;
    this.dragging = { col, type, index };
    
    e.preventDefault();
  }
  
  /**
   * Процесс перетаскивания
   */
  handleMouseMove(e) {
    if (!this.dragging || this.dragStartY === null) return;
    
    const rect = this.container.querySelector('#abacus-svg').getBoundingClientRect();
    const y = e.clientY - rect.top;
    const deltaY = y - this.dragStartY;
    const threshold = 10; // порог срабатывания
    
    if (this.dragging.type === 'heaven') {
      // Верхняя бусина
      if (deltaY > threshold && this.beads[this.dragging.col].heaven !== 'down') {
        this.beads[this.dragging.col].heaven = 'down';
        this.render();
      } else if (deltaY < -threshold && this.beads[this.dragging.col].heaven !== 'up') {
        this.beads[this.dragging.col].heaven = 'up';
        this.render();
      }
    } else {
      // Нижние бусины
      const earthBeads = [...this.beads[this.dragging.col].earth];
      let changed = false;
      
      if (deltaY < -threshold) {
        // Тянем ВВЕРХ - активируем эту и все предыдущие
        for (let i = 0; i <= this.dragging.index; i++) {
          if (earthBeads[i] !== 'up') {
            earthBeads[i] = 'up';
            changed = true;
          }
        }
      } else if (deltaY > threshold) {
        // Тянем ВНИЗ - деактивируем эту и все последующие
        for (let i = this.dragging.index; i < 4; i++) {
          if (earthBeads[i] !== 'down') {
            earthBeads[i] = 'down';
            changed = true;
          }
        }
      }
      
      if (changed) {
        this.beads[this.dragging.col].earth = earthBeads;
        this.render();
      }
    }
    
    e.preventDefault();
  }
  
  /**
   * Окончание перетаскивания
   */
  handleMouseUp() {
    this.dragging = null;
    this.dragStartY = null;
  }
  
  /**
   * Получить значение с абакуса (совместимость с текущим API)
   * @returns {number}
   */
  getValue() {
    let total = 0;
    for (let col = 0; col < this.digitCount; col++) {
      const multiplier = Math.pow(10, this.digitCount - col - 1);
      let colValue = 0;
      
      // Небесная бусина = 5
      if (this.beads[col].heaven === 'down') {
        colValue += 5;
      }
      
      // Земные бусины = 1 каждая
      this.beads[col].earth.forEach(position => {
        if (position === 'up') colValue += 1;
      });
      
      total += colValue * multiplier;
    }
    return total;
  }
  
  /**
   * Установить значение на абакусе (совместимость с текущим API)
   * @param {number} value - Число для отображения
   */
  setValue(value) {
    const digits = String(value).padStart(this.digitCount, '0').split('');
    
    digits.forEach((digit, index) => {
      const num = parseInt(digit, 10);
      
      // Раскладываем на 5*U + L
      if (num >= 5) {
        this.beads[index].heaven = 'down';
        const remainder = num - 5;
        this.beads[index].earth = [
          remainder >= 1 ? 'up' : 'down',
          remainder >= 2 ? 'up' : 'down',
          remainder >= 3 ? 'up' : 'down',
          remainder >= 4 ? 'up' : 'down'
        ];
      } else {
        this.beads[index].heaven = 'up';
        this.beads[index].earth = [
          num >= 1 ? 'up' : 'down',
          num >= 2 ? 'up' : 'down',
          num >= 3 ? 'up' : 'down',
          num >= 4 ? 'up' : 'down'
        ];
      }
    });
    
    this.render();
    console.log(`🧮 Установлено значение: ${value}`);
  }
  
  /**
   * Сброс абакуса (все бусины в исходное положение)
   */
  reset() {
    for (let col = 0; col < this.digitCount; col++) {
      this.beads[col].heaven = 'up';
      this.beads[col].earth = ['down', 'down', 'down', 'down'];
    }
    this.render();
    console.log('🧮 Абакус сброшен');
  }
  
  /**
   * Изменить количество разрядов (для будущего использования)
   * @param {number} count - Новое количество разрядов
   */
  setDigitCount(count) {
    this.digitCount = count;
    this.columns = count;
    this.beads = {};
    this.init();
  }
  
  /**
   * Получить значение конкретной стойки (для совместимости)
   * @param {number} colIndex - Индекс стойки
   * @returns {number}
   */
  getColumnValue(colIndex) {
    if (!this.beads[colIndex]) return 0;
    
    let value = 0;
    if (this.beads[colIndex].heaven === 'down') {
      value += 5;
    }
    this.beads[colIndex].earth.forEach(pos => {
      if (pos === 'up') value += 1;
    });
    
    return value;
  }
}