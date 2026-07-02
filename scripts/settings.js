import {
  MODULE_ID,
  SETTINGS,
  SETTINGS_DEFAULTS
} from "./config.js";
import { getHTMLElement } from "./utils.js";

const SETTINGS_GROUPS = {
  Settings: [SETTINGS.PLAYER_TOGGLE_DEFAULT, SETTINGS.SHOW_FOR_GM],
  Advanced: [SETTINGS.DEBUG]
};

export function registerSettings() {
  [
    SETTINGS.PLAYER_TOGGLE_DEFAULT,
    SETTINGS.DEBUG,
    SETTINGS.SHOW_FOR_GM
  ].forEach((key) => registerBooleanSetting(key, SETTINGS_DEFAULTS[key]));
}

function registerBooleanSetting(key, defaultValue) {
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
    .filter((row) => row && !row.closest(".daavy-lightswitch-settings-group"));

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
