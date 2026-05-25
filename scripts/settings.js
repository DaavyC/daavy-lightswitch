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

const SETTING_DEFINITIONS = [
  { key: SETTINGS.PLAYER_TOGGLE_DEFAULT, defaultValue: true },
  { key: SETTINGS.DEBUG, defaultValue: false },
  { key: SETTINGS.SHOW_FOR_GM, defaultValue: false }
];

export function registerSettings() {
  registerResetMenu();
  SETTING_DEFINITIONS.forEach(registerBooleanSetting);
  Hooks.on("renderSettingsConfig", organizeSettingsConfig);
}

function registerResetMenu() {
  game.settings.registerMenu(MODULE_ID, "resetSettings", {
    name: `${MODULE_ID}.settings.reset.name`,
    hint: `${MODULE_ID}.settings.reset.hint`,
    icon: "fas fa-layer-group",
    type: ResetSettingsDialog,
    restricted: true
  });
}

function registerBooleanSetting({ key, defaultValue }) {
  game.settings.register(MODULE_ID, key, {
    name: `${MODULE_ID}.settings.${key}.name`,
    hint: `${MODULE_ID}.settings.${key}.hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: defaultValue
  });
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
}

function groupSettingRows(container, doc, groupKey, settingKeys) {
  const rows = settingKeys
    .map((key) => findSettingRow(container, key))
    .filter(isUngroupedSettingRow);

  if (!rows.length) return;

  const fieldset = createGroupFieldset(doc, groupKey);
  rows[0].replaceWith(fieldset);

  for (const row of rows) {
    row.remove();
    row.classList.add("daavy-lightswitch-settings-row");
    fieldset.appendChild(row);
  }
}

function isUngroupedSettingRow(row) {
  return row && !hasClassAncestor(row, "daavy-lightswitch-settings-group");
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

async function resetSettingsToDefault(app) {
  await Promise.all(Object.entries(SETTINGS_DEFAULTS).map(([key, value]) => (
    game.settings.set(MODULE_ID, key, value)
  )));
  app?.render?.(true);
}

export async function confirmResetSettings(app = game.settings.sheet) {
  const confirmed = await showResetConfirmation();
  if (!confirmed) return;

  await resetSettingsToDefault(app);
}

export class ResetSettingsDialog extends (globalThis.FormApplication ?? class {}) {
  constructor(...args) {
    super(...args);

    return {
      render: () => confirmResetSettings(game.settings.sheet)
    };
  }
}

async function showResetConfirmation() {
  const options = getResetDialogOptions();

  if (globalThis.foundry?.applications?.api?.DialogV2) {
    return globalThis.foundry.applications.api.DialogV2.confirm(options);
  }

  return new Promise((resolve) => {
    globalThis.Dialog.confirm({
      title: options.window.title,
      content: options.content,
      yes: () => resolve(true),
      no: () => resolve(false),
      defaultYes: false
    });
  });
}

function getResetDialogOptions() {
  return {
    window: { title: localizeReset("title") },
    content: `<p>${localizeReset("content")}</p>`,
    yes: {
      action: "yes",
      icon: "fa-solid fa-check",
      label: localizeReset("yes")
    },
    no: {
      action: "no",
      icon: "fa-solid fa-xmark",
      label: localizeReset("no")
    }
  };
}

function localizeReset(key) {
  return game.i18n.localize(`${MODULE_ID}.settings.reset.confirm.${key}`);
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
