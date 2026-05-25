import { MODULE_ID, SETTINGS } from "./constants.js";

const SETTINGS_GROUPS = {
  Settings: [
    SETTINGS.PLAYER_TOGGLE_DEFAULT,
    SETTINGS.SHOW_FOR_GM,
    SETTINGS.DEBUG
  ]
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
}

function groupSettingRows(container, doc, groupKey, settingKeys) {
  const rows = settingKeys
    .map((key) => findSettingRow(container, key))
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
