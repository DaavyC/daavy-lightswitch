import { MODULE_ID, SETTINGS } from "./constants.js";

const SETTINGS_GROUPS = {
  Settings: [
    SETTINGS.PLAYER_TOGGLE_DEFAULT,
    SETTINGS.SHOW_FOR_GM
  ],
  Advanced: [
    SETTINGS.DEBUG
  ]
};

const SETTINGS_DEFAULTS = {
  [SETTINGS.PLAYER_TOGGLE_DEFAULT]: true,
  [SETTINGS.SHOW_FOR_GM]: false,
  [SETTINGS.DEBUG]: false
};

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.PLAYER_TOGGLE_DEFAULT, {
    name: `${MODULE_ID}.settings.playerToggleDefault.name`,
    hint: `${MODULE_ID}.settings.playerToggleDefault.hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.DEBUG, {
    name: `${MODULE_ID}.settings.debug.name`,
    hint: `${MODULE_ID}.settings.debug.hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.SHOW_FOR_GM, {
    name: `${MODULE_ID}.settings.showForGM.name`,
    hint: `${MODULE_ID}.settings.showForGM.hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  Hooks.on("renderSettingsConfig", organizeSettingsConfig);
}

export function getPlayerToggleDefault() {
  return game.settings.get(MODULE_ID, SETTINGS.PLAYER_TOGGLE_DEFAULT);
}

export function isDebugEnabled() {
  if (typeof game === "undefined") return false;
  return game.settings.get(MODULE_ID, SETTINGS.DEBUG) === true;
}

export function shouldShowForGM() {
  if (typeof game === "undefined") return false;
  return game.settings.get(MODULE_ID, SETTINGS.SHOW_FOR_GM) === true;
}

export function organizeSettingsConfig(app, html) {
  const container = getHTMLElement(html);
  if (!container) return;

  const doc = container.ownerDocument ?? document;

  for (const [groupKey, settingKeys] of Object.entries(SETTINGS_GROUPS)) {
    groupSettingRows(container, doc, groupKey, settingKeys);
  }

  injectResetButton(app, container, doc);
}

function groupSettingRows(container, doc, groupKey, settingKeys) {
  const rows = settingKeys
    .map((key) => findSettingRow(container, key))
    .filter((row) => row && !hasClassAncestor(row, "daavy-lightswitch-settings-group"))
    .filter(Boolean);

  if (!rows.length) return;

  const fieldset = createGroupFieldset(doc, groupKey);
  rows[0].replaceWith(fieldset);

  for (const row of rows) {
    row.remove();
    row.classList.add("daavy-lightswitch-settings-row");
    fieldset.appendChild(row);
  }
}

function createGroupFieldset(doc, groupKey) {
  const fieldset = doc.createElement("fieldset");
  fieldset.className = "daavy-lightswitch-settings-group";

  const legend = doc.createElement("legend");
  legend.textContent = game.i18n.localize(`${MODULE_ID}.settings.groups.${groupKey}`);
  legend.className = "daavy-lightswitch-settings-group-title";
  fieldset.appendChild(legend);

  return fieldset;
}

function injectResetButton(app, container, doc) {
  removeExistingResetRows(container);

  const resetRow = doc.createElement("div");
  resetRow.className = "form-group daavy-lightswitch-settings-reset-row";

  const label = doc.createElement("label");

  const labelIcon = doc.createElement("i");
  labelIcon.className = "fa-solid fa-globe";
  label.appendChild(labelIcon);
  label.appendChild(doc.createTextNode(game.i18n.localize(`${MODULE_ID}.settings.reset.name`)));

  const hint = doc.createElement("p");
  hint.className = "hint";
  hint.textContent = game.i18n.localize(`${MODULE_ID}.settings.reset.hint`);

  const fields = doc.createElement("div");
  fields.className = "form-fields";

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "daavy-lightswitch-settings-reset";
  button.title = game.i18n.localize(`${MODULE_ID}.settings.reset.name`);
  button.setAttribute("aria-label", game.i18n.localize(`${MODULE_ID}.settings.reset.name`));

  const icon = doc.createElement("i");
  icon.className = "fa-solid fa-layer-group";
  button.appendChild(icon);

  button.addEventListener("click", () => confirmResetSettings(app));

  fields.appendChild(button);
  resetRow.appendChild(label);
  resetRow.appendChild(hint);
  resetRow.appendChild(fields);
  insertBeforeFirstGroup(container, resetRow);
}

async function resetSettingsToDefault(app) {
  await Promise.all(Object.entries(SETTINGS_DEFAULTS).map(([key, value]) => (
    game.settings.set(MODULE_ID, key, value)
  )));
  app?.render?.(true);
}

export async function confirmResetSettings(app) {
  const confirmed = await showResetConfirmation();
  if (!confirmed) return;

  await resetSettingsToDefault(app);
}

async function showResetConfirmation() {
  const title = game.i18n.localize(`${MODULE_ID}.settings.reset.confirm.title`);
  const content = `<p>${game.i18n.localize(`${MODULE_ID}.settings.reset.confirm.content`)}</p>`;
  const yes = {
    action: "yes",
    icon: "fa-solid fa-check",
    label: game.i18n.localize(`${MODULE_ID}.settings.reset.confirm.yes`)
  };
  const no = {
    action: "no",
    icon: "fa-solid fa-xmark",
    label: game.i18n.localize(`${MODULE_ID}.settings.reset.confirm.no`)
  };

  if (globalThis.foundry?.applications?.api?.DialogV2) {
    return globalThis.foundry.applications.api.DialogV2.confirm({
      window: { title },
      content,
      yes,
      no
    });
  }

  return new Promise((resolve) => {
    globalThis.Dialog.confirm({
      title,
      content,
      yes: () => resolve(true),
      no: () => resolve(false),
      defaultYes: false
    });
  });
}

function removeExistingResetRows(container) {
  const rows = typeof container.querySelectorAll === "function"
    ? [...container.querySelectorAll(".daavy-lightswitch-settings-reset-row")]
    : findElementsByClass(container, "daavy-lightswitch-settings-reset-row");

  for (const row of rows) {
    row.remove();
  }
}

function insertBeforeFirstGroup(container, element) {
  const firstGroup = getSettingsGroups(container)[0];

  if (!firstGroup) {
    container.appendChild(element);
    return;
  }

  if (typeof firstGroup.before === "function") {
    firstGroup.before(element);
    return;
  }

  const parent = firstGroup.parentElement ?? container;
  const index = parent.children.indexOf(firstGroup);
  parent.children.splice(index, 0, element);
  element.parentElement = parent;
}

function getSettingsGroups(container) {
  if (typeof container.querySelectorAll === "function") {
    return [...container.querySelectorAll(".daavy-lightswitch-settings-group")];
  }

  const groups = [];
  collectSettingsGroups(container, groups);
  return groups;
}

function collectSettingsGroups(element, groups) {
  if (element.className?.split(" ").includes("daavy-lightswitch-settings-group")) {
    groups.push(element);
  }

  for (const child of element.children ?? []) {
    collectSettingsGroups(child, groups);
  }
}

function findElementsByClass(element, className, results = []) {
  if (element.className?.split(" ").includes(className)) {
    results.push(element);
  }

  for (const child of element.children ?? []) {
    findElementsByClass(child, className, results);
  }

  return results;
}

function hasClassAncestor(element, className) {
  let parent = element.parentElement;

  while (parent) {
    if (parent.className?.split(" ").includes(className)) return true;
    parent = parent.parentElement;
  }

  return false;
}

function findSettingRow(container, key) {
  const settingId = `${MODULE_ID}.${key}`;
  return container.querySelector(`[data-setting-id="${settingId}"]`)?.closest(".form-group")
    ?? container.querySelector(`[id$="${settingId}"]`)?.closest(".form-group")
    ?? null;
}

function getHTMLElement(html) {
  if (typeof HTMLElement !== "undefined" && html instanceof HTMLElement) return html;
  if (typeof html?.querySelector === "function") return html;
  if (Array.isArray(html)) return html[0] ?? null;
  if (html?.jquery) return html[0] ?? null;
  if (typeof html?.get === "function") return html.get(0) ?? null;
  return null;
}
