import { createScreenShell, createButton, createStepIndicator } from "./helper.js";
import { resetResults, state } from "../core/state.js";

/**
 * Экран "Результаты"
 * Показывается КАЖДЫЙ раз после окончания тренировки (основной или retry).
 * Здесь:
 *   - статистика
 *   - кнопка "Исправить ошибки" (только если есть ошибки)
 *   - кнопка "Запустить новое задание"
 *
 * ВАЖНО:
 *   Перед navigate("results") тренажёр обязан заполнить state.results:
 *   state.results = {
 *     total: number,
 *     success: number,
 *     wrongExamples: [ { steps, answer, userAnswer }, ... ]
 *   }
 *
 *   А также:
 *   state.retryMode = { enabled: false, examples: [] } // тренажёр сам сбрасывает
 */
export function renderResults(container, { t, navigate }) {
  // Создаём стандартный layout экрана
  const { section, body, heading, paragraph } = createScreenShell({
    title: t("results.title"),
    description: t("results.description"),
    className: "results-screen"
  });

  // Индикатор шага мастера (верхняя полоска с шагами 1/2/3/4)
  const indicator = createStepIndicator("results", t);
  section.insertBefore(indicator, section.firstChild);

  // Заголовок и подпись
  heading.textContent = t("results.title");
  paragraph.textContent = t("results.description");

  // --- Данные, которые тренажёр должен был записать перед navigate("results") ---
  // state.results = {
  //   total: number,
  //   success: number,
  //   wrongExamples: [ { steps, answer, userAnswer }, ... ]
  // }
  const total = state.results.total ?? 0;
  const success = state.results.success ?? 0;
  const wrongExamples = state.results.wrongExamples || [];

  const mistakes = wrongExamples.length;
  const successPercent = total ? Math.round((success / total) * 100) : 0;
  const mistakePercent = total ? Math.round((mistakes / total) * 100) : 0;

  // --- Карточка прогресса (Верно / Ошибки) ---
  const progressCard = document.createElement("div");
  progressCard.className = "results-card";

  const progressBar = document.createElement("div");
  progressBar.className = "progress";

  const bar = document.createElement("div");
  bar.className = "progress__bar";

  const fill = document.createElement("div");
  fill.className = "progress__fill";
  fill.style.width = `${successPercent}%`;
  bar.appendChild(fill);

  const labels = document.createElement("div");
  labels.className = "progress__labels";

  // блок "Верно"
  const successLabel = document.createElement("div");
  successLabel.className = "progress__label";

  const successStrong = document.createElement("strong");
  successStrong.textContent = `${t("results.success")}:`;
  successLabel.appendChild(successStrong);

  successLabel.appendChild(
    document.createTextNode(
      ` ${success} / ${total} (${successPercent}%)`
    )
  );

  // блок "Ошибки"
  const mistakesLabel = document.createElement("div");
  mistakesLabel.className = "progress__label";

  const mistakesStrong = document.createElement("strong");
  mistakesStrong.textContent = `${t("results.mistakes")}:`;
  mistakesLabel.appendChild(mistakesStrong);

  mistakesLabel.appendChild(
    document.createTextNode(
      ` ${mistakes} / ${total} (${mistakePercent}%)`
    )
  );

  labels.append(successLabel, mistakesLabel);
  progressBar.append(bar, labels);
  progressCard.appendChild(progressBar);

  // --- Блок кнопок действий ---
  const actions = document.createElement("div");
  actions.className = "form__actions";

  // 1) Кнопка "Запустить новое задание"
  //    - сбрасываем результаты
  //    - выключаем retryMode
  //    - уходим на экран настроек (чтобы задать новое задание)
  const newTaskButton = createButton({
    label: t("results.cta"), // например "Запустить новое задание"
    onClick: () => {
      resetResults(); // чистит state.results

      state.retryMode = {
        enabled: false,
        examples: []
      };

      navigate("settings");
    }
  });

  // 2) Кнопка "Исправить ошибки"
  //    появляется ТОЛЬКО если есть ошибки
  //    запускает game с теми же примерами, где были ошибки
  //    (без генератора)
  if (mistakes > 0) {
    const retryButton = createButton({
      label: `${t("results.retryErrors")} (${mistakes})`, // "Исправить ошибки (3)"
      onClick: () => {
        // Готовим режим повторения в state
        state.retryMode = {
          enabled: true,
          examples: wrongExamples
        };

        // Не сбрасываем результаты сейчас — пускай игра снова насчитает,
        // а потом сама перезапишет state.results и вернёт нас на этот же экран.
        navigate("game");
      }
    });

    // делаем эту кнопку визуально как вторичную
    retryButton.classList.add("btn--secondary");

    // кнопка исправления ошибок должна быть слева,
    // поэтому сначала добавляем retry, потом newTaskButton
    actions.appendChild(retryButton);
  }

  actions.appendChild(newTaskButton);

  // Собираем всё в body
  body.append(progressCard, actions);

  // Добавляем весь экран в контейнер
  container.appendChild(section);
}
