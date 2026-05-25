import { MODULE_ID, SETTINGS } from "./constants.js";

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
