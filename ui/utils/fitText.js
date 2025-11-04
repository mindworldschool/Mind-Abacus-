// ui/utils/fitText.js
/**
 * Подгоняет масштаб el по ширине box так, чтобы строка помещалась в контейнер.
 * Работает через transform: scale(), не ломая высоту строки.
 */
export function fitTextToBox(el, box, { padding = 24, minScale = 0.7 } = {}) {
  if (!el || !box) return;

  // Сброс предыдущего масштабирования
  el.style.transform = "scale(1)";
  el.style.transformOrigin = "center center";

  // Доступная ширина
  const available = box.clientWidth - padding * 2;
  const needed = el.scrollWidth;

  if (available <= 0 || needed <= 0) return;

  const scale = Math.max(minScale, Math.min(1, available / needed));
  el.style.transform = `scale(${scale})`;
}
