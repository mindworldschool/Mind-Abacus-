import { createScreenShell, createButton, createStepIndicator } from "./helper.js";
import { state } from "../core/state.js";

function createFormRow(labelText) {
  const row = document.createElement("div");
  row.className = "settings-grid__row";

  const label = document.createElement("span");
  label.className = "settings-grid__label";
  label.textContent = labelText;

  const control = document.createElement("div");
  control.className = "settings-grid__control";

  row.append(label, control);

  return { row, control, label };
}

function createSelect(options, value, onChange) {
  const select = document.createElement("select");
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    if (option.value === value) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
  select.value = value;
  select.addEventListener("change", () => {
    onChange(select.value);
  });
  return select;
}

function createCheckbox(labelText, checked, onChange, className = "settings-checkbox") {
  const label = document.createElement("label");
  label.className = className;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => {
    onChange(input.checked);
    label.classList.toggle("is-active", input.checked);
  });

  const text = document.createElement("span");
  text.textContent = labelText;

  label.append(input, text);
  label.classList.toggle("is-active", checked);
  return label;
}

function createCounter({ count, infinite, infinityLabel, onUpdate }) {
  let finiteValue = count || 1;

  const wrapper = document.createElement("div");
  wrapper.className = "counter";

  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "counter__btn";
  minus.textContent = "−";

  const input = document.createElement("input");
  input.type = "number";
  input.className = "counter__input";
  input.min = "1";
  input.value = String(count ?? finiteValue);
  input.disabled = infinite;
  if (infinite) {
    input.value = "";
    input.placeholder = infinityLabel;
  }

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "counter__btn";
  plus.textContent = "+";

  const infinityWrap = document.createElement("label");
  infinityWrap.className = "counter__infinity";
  const infinityInput = document.createElement("input");
  infinityInput.type = "checkbox";
  infinityInput.checked = infinite;
  const infinityText = document.createElement("span");
  infinityText.textContent = infinityLabel;
  infinityWrap.append(infinityInput, infinityText);

  function emit(countValue, infiniteValue) {
    const nextCount = Math.max(1, Number.isNaN(Number(countValue)) ? 1 : Number(countValue));
    if (!infiniteValue) {
      finiteValue = nextCount;
    }
    onUpdate({ count: nextCount, infinite: infiniteValue });
  }

  minus.addEventListener("click", () => {
    if (infinityInput.checked) {
      return;
    }
    const next = Math.max(1, (parseInt(input.value, 10) || finiteValue) - 1);
    input.value = String(next);
    emit(next, false);
  });

  plus.addEventListener("click", () => {
    if (infinityInput.checked) {
      return;
    }
    const next = (parseInt(input.value, 10) || finiteValue) + 1;
    input.value = String(next);
    emit(next, false);
  });

  input.addEventListener("change", () => {
    const value = Math.max(1, parseInt(input.value, 10) || finiteValue);
    input.value = String(value);
    emit(value, false);
  });

  infinityInput.addEventListener("change", () => {
    const isInfinite = infinityInput.checked;
    input.disabled = isInfinite;
    if (isInfinite) {
      input.value = "";
      input.placeholder = infinityLabel;
    } else {
      input.value = String(finiteValue);
      input.placeholder = "";
    }
    emit(finiteValue, isInfinite);
  });

  wrapper.append(minus, input, plus, infinityWrap);
  return wrapper;
}

function createSection(title) {
  const section = document.createElement("section");
  section.className = "settings-section";

  const heading = document.createElement("h3");
  heading.className = "settings-section__title";
  heading.textContent = title;

  section.appendChild(heading);
  return section;
}

function createBlockCard({
  key,
  title,
  digits,
  stateBlock,
  onUpdate,
  allLabel,
  additionLabel,
  subtractionLabel
}) {
  const card = document.createElement("div");
  card.className = "block-card";

  const header = document.createElement("div");
  header.className = "block-card__header";

  const heading = document.createElement("h4");
  heading.className = "block-card__title";
  heading.textContent = title;

  const digitWrap = document.createElement("div");
  digitWrap.className = "block-card__digits";
  const orderMap = new Map(digits.map((digit, index) => [digit, index]));
  const digitInputs = digits.map((digit) => {
    const label = document.createElement("label");
    label.className = "digit-chip";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = stateBlock.digits.includes(digit);

    const text = document.createElement("span");
    text.className = "digit-chip__text";
    text.textContent = digit;

    label.append(input, text);
    label.classList.toggle("digit-chip--active", input.checked);

    input.addEventListener("change", () => {
      label.classList.toggle("digit-chip--active", input.checked);
      const current = new Set(state.settings.blocks[key].digits);
      if (input.checked) {
        current.add(digit);
      } else {
        current.delete(digit);
      }
      const nextDigits = Array.from(current).sort((a, b) => {
        const orderA = orderMap.get(a) ?? 0;
        const orderB = orderMap.get(b) ?? 0;
        return orderA - orderB;
      });
      onUpdate({ digits: nextDigits });
      updateAllToggle();
    });

    digitWrap.appendChild(label);
    return { input, label, digit };
  });

  const allToggle = createCheckbox(allLabel, stateBlock.digits.length === digits.length, (checked) => {
    const nextDigits = checked ? [...digits] : [];
    digitInputs.forEach(({ input, label }) => {
      input.checked = checked;
      label.classList.toggle("digit-chip--active", checked);
    });
    onUpdate({ digits: nextDigits });
    allToggle.classList.toggle("is-active", checked);
  }, "settings-checkbox settings-checkbox--pill");

  function updateAllToggle() {
    const activeCount = digitInputs.filter(({ input }) => input.checked).length;
    const input = allToggle.querySelector("input");
    const isAllSelected = activeCount === digits.length && digits.length > 0;
    input.checked = isAllSelected;
    allToggle.classList.toggle("is-active", isAllSelected);
  }

  header.append(heading, allToggle);
  card.append(header, digitWrap);
  updateAllToggle();

  const footer = document.createElement("div");
  footer.className = "block-card__footer";

  const additionToggle = createCheckbox(additionLabel, stateBlock.onlyAddition, (checked) => {
    onUpdate({ onlyAddition: checked });
  }, "settings-checkbox settings-checkbox--outline");

  const subtractionToggle = createCheckbox(subtractionLabel, stateBlock.onlySubtraction, (checked) => {
    onUpdate({ onlySubtraction: checked });
  }, "settings-checkbox settings-checkbox--outline");

  footer.append(additionToggle, subtractionToggle);
  card.appendChild(footer);

  return card;
}

export function renderSettings(container, { t, state, updateSettings, navigate }) {
  const { section, body, heading, paragraph } = createScreenShell({
    title: t("settings.title"),
    description: t("settings.description"),
    className: "settings-screen"
  });

  const indicator = createStepIndicator("settings", t);
  section.insertBefore(indicator, section.firstChild);

  heading.textContent = t("settings.title");
  paragraph.textContent = t("settings.description");

  const form = document.createElement("form");
  form.className = "form settings-form";

  const baseGrid = document.createElement("div");
  baseGrid.className = "settings-grid";

  const settingsState = state.settings;

  const modeRow = createFormRow(t("settings.modeLabel"));
  modeRow.control.appendChild(
    createSelect(t("settings.modeOptions"), settingsState.mode, (value) => {
      updateSettings({ mode: value });
    })
  );
  baseGrid.appendChild(modeRow.row);

  const digitsRow = createFormRow(t("settings.digitsLabel"));
  digitsRow.control.appendChild(
    createSelect(t("settings.digitsOptions"), settingsState.digits, (value) => {
      updateSettings({ digits: value });
    })
  );
  baseGrid.appendChild(digitsRow.row);

  const combineRow = createFormRow(t("settings.combineLabel"));
  combineRow.control.appendChild(
    createCheckbox("", settingsState.combineLevels, (checked) => {
      updateSettings({ combineLevels: checked });
    }, "settings-checkbox settings-checkbox--switch")
  );
  baseGrid.appendChild(combineRow.row);

  const actionsRow = createFormRow(t("settings.actions.label"));
  actionsRow.control.appendChild(
    createCounter({
      count: settingsState.actions.count,
      infinite: settingsState.actions.infinite,
      infinityLabel: t("settings.actions.infinityLabel"),
      onUpdate: ({ count, infinite }) => {
        const current = state.settings.actions;
        updateSettings({ actions: { ...current, count, infinite } });
      }
    })
  );
  baseGrid.appendChild(actionsRow.row);

  const examplesRow = createFormRow(t("settings.examples.label"));
  examplesRow.control.appendChild(
    createCounter({
      count: settingsState.examples.count,
      infinite: settingsState.examples.infinite,
      infinityLabel: t("settings.examples.infinityLabel"),
      onUpdate: ({ count, infinite }) => {
        const current = state.settings.examples;
        updateSettings({ examples: { ...current, count, infinite } });
      }
    })
  );
  baseGrid.appendChild(examplesRow.row);

  const timeRow = createFormRow(t("settings.timeLabel"));
  timeRow.control.appendChild(
    createSelect(t("settings.timeOptions"), settingsState.timeLimit, (value) => {
      updateSettings({ timeLimit: value });
    })
  );
  baseGrid.appendChild(timeRow.row);

  const speedRow = createFormRow(t("settings.speedLabel"));
  speedRow.control.appendChild(
    createSelect(t("settings.speedOptions"), settingsState.speed, (value) => {
      updateSettings({ speed: value });
    })
  );
  baseGrid.appendChild(speedRow.row);

  form.appendChild(baseGrid);

  const advancedSection = createSection(t("settings.advancedLabel"));
  const toggleList = document.createElement("div");
  toggleList.className = "toggle-list";

  const toggleTranslations = t("settings.toggles");
  Object.entries(toggleTranslations).forEach(([key, label]) => {
    const toggle = createCheckbox(label, Boolean(settingsState.toggles[key]), (checked) => {
      updateSettings({
        toggles: { ...state.settings.toggles, [key]: checked }
      });
    }, "toggle-pill");
    toggleList.appendChild(toggle);
  });
  advancedSection.appendChild(toggleList);
  form.appendChild(advancedSection);

  const blocksSection = createSection(t("settings.blocksLabel"));
  const blocksTranslations = t("settings.blocks");
  const blockOrder = ["simple", "brothers", "friends", "mix"];

  blockOrder.forEach((key) => {
    const blockCard = createBlockCard({
      key,
      title: blocksTranslations[key].title,
      digits: blocksTranslations[key].digits,
      stateBlock: settingsState.blocks[key],
      allLabel: t("settings.allLabel"),
      additionLabel: t("settings.onlyAdditionLabel"),
      subtractionLabel: t("settings.onlySubtractionLabel"),
      onUpdate: (changes) => {
        updateSettings({
          blocks: {
            ...state.settings.blocks,
            [key]: { ...state.settings.blocks[key], ...changes }
          }
        });
      }
    });
    blocksSection.appendChild(blockCard);
  });
  form.appendChild(blocksSection);

  const extraGrid = document.createElement("div");
  extraGrid.className = "settings-grid";

  const transitionRow = createFormRow(t("settings.transitionLabel"));
  transitionRow.control.appendChild(
    createSelect(t("settings.transitionOptions"), settingsState.transition, (value) => {
      updateSettings({ transition: value });
    })
  );
  extraGrid.appendChild(transitionRow.row);

  const inlineRow = createFormRow(t("settings.inlineLabel"));
  inlineRow.control.appendChild(
    createCheckbox("", settingsState.inline, (checked) => {
      updateSettings({ inline: checked });
    }, "settings-checkbox settings-checkbox--switch")
  );
  extraGrid.appendChild(inlineRow.row);

  form.appendChild(extraGrid);

  const actions = document.createElement("div");
  actions.className = "form__actions";
  const submitButton = createButton({
    label: t("settings.submit"),
    onClick: () => {
      form.requestSubmit();
    }
  });
  actions.appendChild(submitButton);

  form.appendChild(actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    navigate("confirmation");
  });

  body.appendChild(form);
  container.appendChild(section);
}
