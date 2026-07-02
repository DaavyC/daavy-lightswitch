export const MODULE_ID = "daavy-lightswitch";

export const SETTINGS = {
  PLAYER_TOGGLE_DEFAULT: "playerToggleDefault",
  SHOW_FOR_GM: "showForGM",
  DEBUG: "debug"
};

export const FLAGS = {
  PLAYER_TOGGLE_ENABLED: "playerToggleEnabled",
  IS_OFF: "isOff",
  RESTORE_CONFIG: "restoreConfig"
};

export const TOGGLE_QUERY = `${MODULE_ID}.toggleLight`;

export const SETTINGS_DEFAULTS = {
  [SETTINGS.PLAYER_TOGGLE_DEFAULT]: true,
  [SETTINGS.SHOW_FOR_GM]: false,
  [SETTINGS.DEBUG]: false
};
