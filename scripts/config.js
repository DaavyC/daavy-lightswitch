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

export const FOUNDRY = {
  AMBIENT_LIGHT_TYPE: "AmbientLight",
  UPDATE_PERMISSION: "update",
  SETTING_SCOPE: "world"
};

export const TRUE_VALUES = [true, "true", 1, "1", "on"];

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

export const CANVAS_RENDER = {
  REFRESH_DELAY_MS: 0,
  SWITCH_LAYER_Z_INDEX: 10_000,
  VISIBILITY_TOLERANCE: 0,
  DEFAULT_SCALE: 1
};

export const DOM = {
  FORM_GROUP_CLASS: "form-group",
  HINT_CLASS: "hint",
  BOOLEAN_DTYPE: "Boolean",
  INPUT_TYPES: {
    HIDDEN: "hidden",
    CHECKBOX: "checkbox"
  },
  NAME_INPUT_SELECTOR: '[name="name"]',
  BASIC_TAB_SELECTOR: "form .tab[data-tab='basic']",
  ACTIVE_TAB_SELECTOR: "form .tab.active",
  TAB_SELECTOR: "form .tab",
  FORM_SELECTOR: "form",
  BOARD_CANVAS_SELECTOR: "#board canvas",
  CANVAS_SELECTOR: "canvas",
  POINTER_DOWN_EVENT: "pointerdown",
  PASSIVE_EVENT_MODE: "passive",
  STATIC_EVENT_MODE: "static",
  POINTER_CURSOR: "pointer",
  SETTINGS_ROW_CLASS: "daavy-lightswitch-settings-row",
  SETTINGS_GROUP_CLASS: "daavy-lightswitch-settings-group",
  SETTINGS_GROUP_TITLE_CLASS: "daavy-lightswitch-settings-group-title"
};

export const RESET_DIALOG = {
  MENU_KEY: "resetSettings",
  MENU_ICON: "fas fa-layer-group",
  YES_ACTION: "yes",
  NO_ACTION: "no",
  YES_ICON: "fa-solid fa-check",
  NO_ICON: "fa-solid fa-xmark"
};

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

export const SWITCH_ICON = {
  backgroundAlpha: 0.88,
  backgroundStrokeWidth: 2,
  offGlassAlpha: 0.42,
  onGlassAlpha: 0.95,
  offBaseStroke: 0xa0a0a0,
  glow: {
    outer: { x: 0, y: -3, radius: 11, alpha: 0.16 },
    inner: { x: 0, y: -3, radius: 7, alpha: 0.2 }
  },
  bulb: {
    glass: { x: 0, y: -5, width: 7, height: 8, strokeWidth: 1.6 },
    neck: { points: [-4, 2, 4, 2, 3, 6, -3, 6], strokeWidth: 1.2 }
  },
  filament: {
    line: { points: [-3, -4, -1, -1, 1, -4, 3, -1], width: 1.25, alpha: 0.72 },
    highlight: { x: -2.6, y: -8.2, radius: 1.5, alpha: 0.58 }
  },
  base: {
    separator: { points: [-3.4, 6.5, 3.4, 6.5], color: 0xffef9b, width: 0.9, alpha: 0.72 },
    top: { x: -4.8, y: 5, width: 9.6, height: 4.2, radius: 1.2, alpha: 0.95, strokeWidth: 1.1 },
    bottom: { x: -3.4, y: 9, width: 6.8, height: 2.3, radius: 0.8, alpha: 0.9, strokeWidth: 0.8 }
  }
};

export const DRAWING = {
  DEFAULT_STROKE_ALPHA: 0.95,
  ROUNDED_RECT_STROKE_ALPHA: 0.86,
  POLYGON_STROKE_ALPHA: 0.85
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
