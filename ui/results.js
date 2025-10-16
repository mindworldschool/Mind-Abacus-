import { createScreenShell, createButton, createStepIndicator } from "./helper.js";
import { resetResults, state } from "../core/state.js";

export function renderResults(container, { t, navigate }) {
  const { section, body, heading, paragraph } = createScreenShell({
    title: t("results.title"),
    description: t("results.description"),
    className: "results-screen"
  });

  const indicator = createStepIndicator("results", t);
  section.insertBefore(indicator, section.firstChild);

  heading.textContent = t("results.title");
  paragraph.textContent = t("results.description");

  const total = state.results.total || 10;
  const success = Math.min(state.results.success || 0, total);
  const mistakes = Math.max(total - success, 0);
  const successPercent = total ? Math.round((success / total) * 100) : 0;
  const mistakePercent = Math.max(0, 100 - successPercent);

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

  const successLabel = document.createElement("div");
  successLabel.className = "progress__label";
  successLabel.innerHTML = `<strong>${t("results.success")}:</strong> ${success} / ${total} (${successPercent}%)`;

  const mistakesLabel = document.createElement("div");
  mistakesLabel.className = "progress__label";
  mistakesLabel.innerHTML = `<strong>${t("results.mistakes")}:</strong> ${mistakes} / ${total} (${mistakePercent}%)`;

  labels.append(successLabel, mistakesLabel);
  progressBar.append(bar, labels);

  progressCard.appendChild(progressBar);

  const actions = document.createElement("div");
  actions.className = "form__actions";

  const repeatButton = createButton({
    label: t("results.cta"),
    onClick: () => {
      resetResults();
      navigate("settings");
    }
  });

  actions.appendChild(repeatButton);

  body.append(progressCard, actions);
  container.appendChild(section);
}