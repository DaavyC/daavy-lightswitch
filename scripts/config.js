export const MODULE_ID = "daavy-lightswitch";

export const SETTINGS = {
  PLAYER_TOGGLE_DEFAULT: "playerToggleDefault",
  SHOW_FOR_GM: "showForGM",
  LIMIT_INTERACTION_DISTANCE: "limitInteractionDistance",
  INTERACTION_DISTANCE: "interactionDistance",
  DISTANCE_AFFECTS_GM: "distanceAffectsGM"
};

export const FLAGS = {
  PLAYER_TOGGLE_ENABLED: "playerToggleEnabled",
  IS_OFF: "isOff",
  RESTORE_CONFIG: "restoreConfig"
};

export const TOGGLE_QUERY = `${MODULE_ID}.toggleLight`;

export const SETTINGS_DEFAULTS = {
  [SETTINGS.PLAYER_TOGGLE_DEFAULT]: true,
  [SETTINGS.SHOW_FOR_GM]: true,
  [SETTINGS.LIMIT_INTERACTION_DISTANCE]: false,
  [SETTINGS.INTERACTION_DISTANCE]: 5,
  [SETTINGS.DISTANCE_AFFECTS_GM]: false
};
