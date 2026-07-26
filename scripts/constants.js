export const MODULE_ID = "daavy-lightswitch";
export const I18N_PREFIX = "DAAVY_LIGHTSWITCH";

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
  RESTORE_CONFIG: "restoreConfig",
  CIRCUIT_LINKS: "circuitLinks"
};

export const TOGGLE_QUERY = `${MODULE_ID}.toggleLight`;

export const AMBIENT_LIGHT_TYPE = "AmbientLight";
export const PLAYER_TOGGLE_PATH = `flags.${MODULE_ID}.${FLAGS.PLAYER_TOGGLE_ENABLED}`;
export const IS_OFF_PATH = `flags.${MODULE_ID}.${FLAGS.IS_OFF}`;
export const RESTORE_CONFIG_PATH = `flags.${MODULE_ID}.${FLAGS.RESTORE_CONFIG}`;
export const CIRCUIT_TOOL_NAME = "daavyLightswitchCircuits";
export const HIT_SIZE = 42;
export const CIRCUIT_COLOR = 0xffd76a;
export const CIRCUIT_SELECTED_COLOR = 0xff6868;
export const CIRCUIT_LINE_WIDTH = 3;
