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

export const QUERY_NAMES = {
  TOGGLE_LIGHT: `${MODULE_ID}.toggleLight`
};

export const SETTINGS_GROUPS = {
  Settings: [
    SETTINGS.PLAYER_TOGGLE_DEFAULT,
    SETTINGS.SHOW_FOR_GM
  ],
  Advanced: [
    SETTINGS.DEBUG
  ]
};

export const SETTINGS_DEFAULTS = {
  [SETTINGS.PLAYER_TOGGLE_DEFAULT]: true,
  [SETTINGS.SHOW_FOR_GM]: false,
  [SETTINGS.DEBUG]: false
};

const SETTING_ORDER = [
  SETTINGS.PLAYER_TOGGLE_DEFAULT,
  SETTINGS.DEBUG,
  SETTINGS.SHOW_FOR_GM
];

export const SETTING_DEFINITIONS = SETTING_ORDER.map((key) => ({
  key,
  defaultValue: SETTINGS_DEFAULTS[key]
}));

export const QUERY_TIMEOUT_MS = 5000;

export const FLAG_PATHS = {
  PLAYER_TOGGLE_ENABLED: `flags.${MODULE_ID}.${FLAGS.PLAYER_TOGGLE_ENABLED}`,
  IS_OFF: `flags.${MODULE_ID}.${FLAGS.IS_OFF}`,
  RESTORE_CONFIG: `flags.${MODULE_ID}.${FLAGS.RESTORE_CONFIG}`,
  DELETE_RESTORE_CONFIG: `flags.${MODULE_ID}.-=${FLAGS.RESTORE_CONFIG}`
};

export const SWITCH_SIZE = 28;
export const HIT_SIZE = 42;
export const SWITCH_LAYER_NAME = "daavyLightswitchLayer";

export const COLORS = {
  onBackground: 0x1e1e1e,
  offBackground: 0x2c2c2c,
  onGold: 0xffd76a,
  onGlow: 0xffe8a0,
  onStroke: 0xfff0a3,
  offGlass: 0x777777,
  offStroke: 0xb8b8b8,
  onBase: 0x8d7840,
  offBase: 0x555555,
  filament: 0x7a5a00,
  white: 0xffffff
};

export const HOOK_NAMES = {
  INIT: "init",
  READY: "ready",
  RENDER_SETTINGS_CONFIG: "renderSettingsConfig",
  PRE_CREATE_AMBIENT_LIGHT: "preCreateAmbientLight",
  PRE_UPDATE_AMBIENT_LIGHT: "preUpdateAmbientLight",
  RENDER_AMBIENT_LIGHT_CONFIG: "renderAmbientLightConfig",
  CANVAS_READY: "canvasReady",
  CANVAS_PAN: "canvasPan",
  SIGHT_REFRESH: "sightRefresh",
  CREATE_AMBIENT_LIGHT: "createAmbientLight",
  UPDATE_AMBIENT_LIGHT: "updateAmbientLight",
  DELETE_AMBIENT_LIGHT: "deleteAmbientLight",
  CONTROL_TOKEN: "controlToken",
  UPDATE_TOKEN: "updateToken",
  RENDER_SCENE_CONTROLS: "renderSceneControls"
};
