import {
  I18N_PREFIX,
  MODULE_ID,
  SETTINGS,
  SETTINGS_DEFAULTS
} from "./constants.js";
import { getHTMLElement } from "./utils.js";

const INTERACTION_DISTANCE_GROUP = "InteractionDistance";
const SETTINGS_GROUPS = {
  Settings: [
    SETTINGS.PLAYER_TOGGLE_DEFAULT,
    SETTINGS.SHOW_FOR_GM,
    SETTINGS.LIMIT_INTERACTION_DISTANCE
  ],
  [INTERACTION_DISTANCE_GROUP]: [
    SETTINGS.INTERACTION_DISTANCE,
    SETTINGS.DISTANCE_AFFECTS_GM
  ]
};

export function registerSettings(onChange) {
  [
    SETTINGS.PLAYER_TOGGLE_DEFAULT,
    SETTINGS.SHOW_FOR_GM,
    SETTINGS.LIMIT_INTERACTION_DISTANCE,
    SETTINGS.DISTANCE_AFFECTS_GM
  ].forEach((key) => registerBooleanSetting(key, SETTINGS_DEFAULTS[key], onChange));

  game.settings.register(MODULE_ID, SETTINGS.INTERACTION_DISTANCE, {
    name: `${getSettingI18nKey(SETTINGS.INTERACTION_DISTANCE)}.Name`,
    hint: `${getSettingI18nKey(SETTINGS.INTERACTION_DISTANCE)}.Hint`,
    scope: "world",
    config: true,
    restricted: true,
    type: Number,
    range: {
      min: 0,
      max: 20,
      step: 1
    },
    default: SETTINGS_DEFAULTS[SETTINGS.INTERACTION_DISTANCE],
    onChange
  });
}

function registerBooleanSetting(key, defaultValue, onChange) {
  const i18nKey = getSettingI18nKey(key);
  game.settings.register(MODULE_ID, key, {
    name: `${i18nKey}.Name`,
    hint: `${i18nKey}.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: defaultValue,
    onChange
  });
}

export function getPlayerToggleDefault() {
  return game.settings.get(MODULE_ID, SETTINGS.PLAYER_TOGGLE_DEFAULT);
}

export function shouldShowForGM() {
  return game.settings.get(MODULE_ID, SETTINGS.SHOW_FOR_GM) === true;
}

function getSettingI18nKey(key) {
  return `${I18N_PREFIX}.Settings.${key[0].toUpperCase()}${key.slice(1)}`;
}

export function organizeSettingsConfig(app, html) {
  const container = getHTMLElement(html);
  if (!container) return;

  const doc = container.ownerDocument ?? document;

  for (const [groupKey, settingKeys] of Object.entries(SETTINGS_GROUPS)) {
    groupSettingRows(container, doc, groupKey, settingKeys);
  }

  configureInteractionDistanceVisibility(container);
}

function groupSettingRows(container, doc, groupKey, settingKeys) {
  const rows = settingKeys
    .map((key) => findSettingRow(container, key))
    .filter((row) => row && !row.closest(".daavy-lightswitch-settings-group"));

  if (!rows.length) return;

  const group = createGroup(doc, groupKey);
  rows[0].replaceWith(group);

  for (const row of rows) {
    row.classList.add("daavy-lightswitch-settings-row");
    group.appendChild(row);
  }
}

export function isInteractionDistanceLimited() {
  return game.settings.get(MODULE_ID, SETTINGS.LIMIT_INTERACTION_DISTANCE) === true;
}

export function getInteractionDistance() {
  return Math.max(0, Number(game.settings.get(MODULE_ID, SETTINGS.INTERACTION_DISTANCE)) || 0);
}

export function doesInteractionDistanceAffectGM() {
  return game.settings.get(MODULE_ID, SETTINGS.DISTANCE_AFFECTS_GM) === true;
}

function createGroup(doc, groupKey) {
  const group = doc.createElement("div");
  group.className = "daavy-lightswitch-settings-group";
  group.dataset.settingsGroup = groupKey;
  group.setAttribute("role", "group");

  const title = doc.createElement("h3");
  title.id = `${MODULE_ID}-settings-group-${groupKey}`;
  title.textContent = game.i18n.localize(`${I18N_PREFIX}.Settings.Groups.${groupKey}`);
  title.className = "daavy-lightswitch-settings-group-title";
  group.setAttribute("aria-labelledby", title.id);
  group.appendChild(title);

  return group;
}

function configureInteractionDistanceVisibility(container) {
  const toggle = findSettingRow(container, SETTINGS.LIMIT_INTERACTION_DISTANCE)
    ?.querySelector('input[type="checkbox"]');
  const group = container.querySelector(`[data-settings-group="${INTERACTION_DISTANCE_GROUP}"]`);
  if (!group) return;

  const updateVisibility = () => {
    group.hidden = !(toggle?.checked ?? isInteractionDistanceLimited());
  };

  updateVisibility();
  toggle?.addEventListener("change", updateVisibility);
}

function findSettingRow(container, key) {
  const settingId = `${MODULE_ID}.${key}`;
  return container.querySelector(`[data-setting-id="${settingId}"]`)?.closest(".form-group")
    ?? container.querySelector(`[id$="${settingId}"]`)?.closest(".form-group")
    ?? null;
}
