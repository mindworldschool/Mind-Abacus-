// Abacus.js - Абакус на чистом JavaScript

class Abacus {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.digitCount = options.digitCount || 2;
    this.visible = options.visible !== false;
    
    this.beads = {};
    this.dragging = null;
    this.dragStartY = null;
    
    this.init();
  }
  
  init() {
    // Инициализация бусин
    for (let col = 0; col < this.digitCount; col++) {
      this.beads[col] = {
        heaven: 'up',
        earth: ['down', 'down', 'down', 'down']
      };
    }
    
    this.render();
    this.attachEventListeners();
  }
  
  render() {
    if (!this.visible) {
      this.container.innerHTML = '';
      return;
    }
    
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
  
  renderDefs() {
    return `
      <defs>
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
        
        <linearGradient id="topFrameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#A0522D" stop-opacity="1" />
          <stop offset="50%" stop-color="#8B4513" stop-opacity="1" />
          <stop offset="100%" stop-color="#6B3410" stop-opacity="1" />
        </linearGradient>
        
        <linearGradient id="metalBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#949494" stop-opacity="1" />
          <stop offset="30%" stop-color="#ababab" stop-opacity="1" />
          <stop offset="50%" stop-color="#757575" stop-opacity="1" />
          <stop offset="70%" stop-color="#8c8c8c" stop-opacity="1" />
          <stop offset="100%" stop-color="#606060" stop-opacity="1" />
        </linearGradient>
        
        <radialGradient id="beadGradient" cx="45%" cy="40%">
          <stop offset="0%" stop-color="#ffb366" stop-opacity="1" />
          <stop offset="50%" stop-color="#ff7c00" stop-opacity="1" />
          <stop offset="100%" stop-color="#cc6300" stop-opacity="1" />
        </radialGradient>
      </defs>
    `;
  }
  
  renderFrame() {
    const width = this.digitCount * 72 + 20;
    return `
      <rect x="10" y="10" width="${width}" height="30" fill="url(#topFrameGradient)" filter="url(#frameShadow)" rx="5"/>
      <rect x="15" y="13" width="${width - 10}" height="4" fill="rgba(255, 255, 255, 0.15)" rx="2"/>
      <rect x="10" y="264" width="${width}" height="30" fill="url(#topFrameGradient)" filter="url(#frameShadow)" rx="5"/>
      <rect x="15" y="267" width="${width - 10}" height="4" fill="rgba(255, 255, 255, 0.15)" rx="2"/>
    `;
  }
  
  renderRods() {
    let rods = '';
    for (let col = 0; col < this.digitCount; col++) {
      const x = 50 + col * 72;
      rods += `<line x1="${x}" y1="40" x2="${x}" y2="264" stroke="#654321" stroke-width="8"/>`;
    }
    return rods;
  }
  
  renderMiddleBar() {
    const width = this.digitCount * 72 + 20;
    return `
      <rect x="10" y="91" width="${width}" height="10" fill="url(#metalBarGradient)" rx="2"/>
      <rect x="15" y="92" width="${width - 10}" height="2" fill="rgba(255, 255, 255, 0.6)" rx="1"/>
      <rect x="10" y="101" width="${width}" height="2" fill="rgba(0, 0, 0, 0.3)" rx="1"/>
    `;
  }
  
  renderBeads() {
    let beadsHTML = '';
    
    for (let col = 0; col < this.digitCount; col++) {
      const x = 50 + col * 72;
      const beadHeight = 36;
      const beadWidth = 32;
      const gapFromBar = 1;
      
      // Небесная бусина
      const heavenY = this.beads[col].heaven === 'down' 
        ? 91 - beadHeight/2 - gapFromBar
        : 40 + beadHeight/2 + gapFromBar;
      
      beadsHTML += this.renderBead(x, heavenY, beadWidth, beadHeight, col, 'heaven', 0);
      
      // Земные бусины
      const earthActive = this.beads[col].earth;
      const upCount = earthActive.filter(p => p === 'up').length;
      const downCount = 4 - upCount;
      
      for (let index = 0; index < 4; index++) {
        let earthY;
        if (earthActive[index] === 'up') {
          const activeIndex = earthActive.slice(0, index).filter(p => p === 'up').length;
          earthY = 101 + beadHeight/2 + gapFromBar + activeIndex * beadHeight;
        } else {
          const inactiveIndex = earthActive.slice(0, index).filter(p => p === 'down').length;
          earthY = 264 - beadHeight/2 - gapFromBar - (downCount - 1 - inactiveIndex) * beadHeight;
        }
        
        beadsHTML += this.renderBead(x, earthY, beadWidth, beadHeight, col, 'earth', index);
      }
    }
    
    return beadsHTML;
  }
  
  renderBead(x, y, width, height, col, type, index) {
    const hw = width;
    const hh = height / 2;
    const cutSize = 12;
    const sideRoundness = 2;
    
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
  
  attachEventListeners() {
    const svg = this.container.querySelector('#abacus-svg');
    if (!svg) return;
    
    svg.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', () => this.handleMouseUp());
    
    // Touch события для мобильных
    svg.addEventListener('touchstart', (e) => this.handleMouseDown(e.touches[0]));
    document.addEventListener('touchmove', (e) => this.handleMouseMove(e.touches[0]));
    document.addEventListener('touchend', () => this.handleMouseUp());
  }
  
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
  
  handleMouseMove(e) {
    if (!this.dragging || this.dragStartY === null) return;
    
    const rect = this.container.querySelector('#abacus-svg').getBoundingClientRect();
    const y = e.clientY - rect.top;
    const deltaY = y - this.dragStartY;
    const threshold = 10;
    
    if (this.dragging.type === 'heaven') {
      if (deltaY > threshold) {
        this.beads[this.dragging.col].heaven = 'down';
        this.render();
      } else if (deltaY < -threshold) {
        this.beads[this.dragging.col].heaven = 'up';
        this.render();
      }
    } else {
      const earthBeads = [...this.beads[this.dragging.col].earth];
      
      if (deltaY < -threshold) {
        // Тянем ВВЕРХ
        for (let i = 0; i <= this.dragging.index; i++) {
          earthBeads[i] = 'up';
        }
        this.beads[this.dragging.col].earth = earthBeads;
        this.render();
      } else if (deltaY > threshold) {
        // Тянем ВНИЗ
        for (let i = this.dragging.index; i < 4; i++) {
          earthBeads[i] = 'down';
        }
        this.beads[this.dragging.col].earth = earthBeads;
        this.render();
      }
    }
    
    e.preventDefault();
  }
  
  handleMouseUp() {
    this.dragging = null;
    this.dragStartY = null;
  }
  
  calculateValue() {
    let total = 0;
    for (let col = 0; col < this.digitCount; col++) {
      const multiplier = Math.pow(10, this.digitCount - col - 1);
      let colValue = 0;
      
      if (this.beads[col].heaven === 'down') {
        colValue += 5;
      }
      
      this.beads[col].earth.forEach(position => {
        if (position === 'up') colValue += 1;
      });
      
      total += colValue * multiplier;
    }
    return total;
  }
  
  reset() {
    for (let col = 0; col < this.digitCount; col++) {
      this.beads[col].heaven = 'up';
      this.beads[col].earth = ['down', 'down', 'down', 'down'];
    }
    this.render();
  }
  
  setDigitCount(count) {
    this.digitCount = count;
    this.beads = {};
    this.init();
  }
  
  show() {
    this.visible = true;
    this.render();
  }
  
  hide() {
    this.visible = false;
    this.render();
  }
  
  toggle() {
    this.visible = !this.visible;
    this.render();
  }
}

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Abacus;
}