// ui/utils/fitText.js
/**
 * Масштабирует элемент el по ширине контейнера box, чтобы строка влезала.
 * Делает это через transform: scale(), не ломая высоту и межстрочные.
 */
export function fitTextToBox(el, box, { padding = 24, minScale = 0.7 } = {}) {
  if (!el || !box) return;

  el.style.transform = "scale(1)";
  el.style.transformOrigin = "center center";

  const available = box.clientWidth - padding * 2;
  const needed = el.scrollWidth;

  if (available <= 0 || needed <= 0) return;

  const scale = Math.max(minScale, Math.min(1, available / needed));
  el.style.transform = `scale(${scale})`;
}

