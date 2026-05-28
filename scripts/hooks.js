import { HOOK_NAMES, MODULE_ID } from "./config.js";
import { registerDebugApi } from "./debug.js";
import { organizeSettingsConfig, registerSettings } from "./settings.js";
import {
  addPlayerToggleField,
  normalizePlayerToggleFlag,
  refreshLightSwitches,
  registerSocket,
  scheduleLightSwitchRefresh,
  setDefaultPlayerToggleFlag
} from "./features.js";

export function registerHooks() {
  Hooks.once(HOOK_NAMES.INIT, onInit);
  Hooks.once(HOOK_NAMES.READY, onReady);
}

function onInit() {
  registerSettings();
  Hooks.on(HOOK_NAMES.RENDER_SETTINGS_CONFIG, organizeSettingsConfig);
}

function onReady() {
  registerDebugApi();
  registerSocket();
  registerAmbientLightConfigHooks();
  registerCanvasIconHooks();
  console.info(`${MODULE_ID} | Ready`);
}

export function registerAmbientLightConfigHooks() {
  registerHookHandlers([
    [HOOK_NAMES.PRE_CREATE_AMBIENT_LIGHT, setDefaultPlayerToggleFlag],
    [HOOK_NAMES.PRE_UPDATE_AMBIENT_LIGHT, normalizePlayerToggleFlag],
    [HOOK_NAMES.RENDER_AMBIENT_LIGHT_CONFIG, addPlayerToggleField]
  ]);
}

export function registerCanvasIconHooks() {
  registerHookHandlers([
    [HOOK_NAMES.CANVAS_READY, refreshLightSwitches],
    [HOOK_NAMES.CANVAS_PAN, refreshLightSwitches],
    [HOOK_NAMES.SIGHT_REFRESH, refreshLightSwitches],
    [HOOK_NAMES.CREATE_AMBIENT_LIGHT, refreshLightSwitches],
    [HOOK_NAMES.UPDATE_AMBIENT_LIGHT, refreshLightSwitches],
    [HOOK_NAMES.DELETE_AMBIENT_LIGHT, refreshLightSwitches],
    [HOOK_NAMES.CONTROL_TOKEN, refreshLightSwitches],
    [HOOK_NAMES.UPDATE_TOKEN, refreshLightSwitches],
    [HOOK_NAMES.RENDER_SCENE_CONTROLS, scheduleLightSwitchRefresh]
  ]);
}

function registerHookHandlers(handlers) {
  for (const [hookName, handler] of handlers) {
    Hooks.on(hookName, handler);
  }
}
