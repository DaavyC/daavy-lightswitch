import {
  DOM,
  FOUNDRY,
  MODULE_ID,
  RESET_DIALOG,
  SETTINGS,
  SETTINGS_DEFAULTS,
  SETTINGS_GROUPS,
  SETTING_DEFINITIONS
} from "./config.js";
import { getHTMLElement, hasClassAncestor } from "./utils.js";

export function registerSettings() {
  registerResetMenu();
  SETTING_DEFINITIONS.forEach(registerBooleanSetting);
}

function registerResetMenu() {
  game.settings.registerMenu(MODULE_ID, RESET_DIALOG.MENU_KEY, {
    name: `${MODULE_ID}.settings.reset.name`,
    hint: `${MODULE_ID}.settings.reset.hint`,
    icon: RESET_DIALOG.MENU_ICON,
    type: ResetSettingsDialog,
    restricted: true
  });
}

function registerBooleanSetting({ key, defaultValue }) {
  game.settings.register(MODULE_ID, key, {
    name: `${MODULE_ID}.settings.${key}.name`,
    hint: `${MODULE_ID}.settings.${key}.hint`,
    scope: FOUNDRY.SETTING_SCOPE,
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
    .filter(isUngroupedSettingRow);

  if (!rows.length) return;

  const fieldset = createGroupFieldset(doc, groupKey);
  rows[0].replaceWith(fieldset);

  for (const row of rows) {
    row.remove();
    row.classList.add(DOM.SETTINGS_ROW_CLASS);
    fieldset.appendChild(row);
  }
}

function isUngroupedSettingRow(row) {
  return row && !hasClassAncestor(row, DOM.SETTINGS_GROUP_CLASS);
}

function createGroupFieldset(doc, groupKey) {
  const fieldset = doc.createElement("fieldset");
  fieldset.className = DOM.SETTINGS_GROUP_CLASS;

  const legend = doc.createElement("legend");
  legend.textContent = game.i18n.localize(`${MODULE_ID}.settings.groups.${groupKey}`);
  legend.className = DOM.SETTINGS_GROUP_TITLE_CLASS;
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
      action: RESET_DIALOG.YES_ACTION,
      icon: RESET_DIALOG.YES_ICON,
      label: localizeReset(RESET_DIALOG.YES_ACTION)
    },
    no: {
      action: RESET_DIALOG.NO_ACTION,
      icon: RESET_DIALOG.NO_ICON,
      label: localizeReset(RESET_DIALOG.NO_ACTION)
    }
  };
}

function localizeReset(key) {
  return game.i18n.localize(`${MODULE_ID}.settings.reset.confirm.${key}`);
}

function findSettingRow(container, key) {
  const settingId = `${MODULE_ID}.${key}`;
  return container.querySelector(`[data-setting-id="${settingId}"]`)?.closest(`.${DOM.FORM_GROUP_CLASS}`)
    ?? container.querySelector(`[id$="${settingId}"]`)?.closest(`.${DOM.FORM_GROUP_CLASS}`)
    ?? null;
}
