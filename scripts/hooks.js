import { MODULE_ID } from "./config.js";
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
  Hooks.once("init", onInit);
  Hooks.once("ready", onReady);
}

function onInit() {
  registerSettings();
  Hooks.on("renderSettingsConfig", organizeSettingsConfig);
}

function onReady() {
  registerSocket();
  registerAmbientLightConfigHooks();
  registerCanvasIconHooks();
  console.info(`${MODULE_ID} | Ready`);
}

export function registerAmbientLightConfigHooks() {
  Hooks.on("preCreateAmbientLight", setDefaultPlayerToggleFlag);
  Hooks.on("preUpdateAmbientLight", normalizePlayerToggleFlag);
  Hooks.on("renderAmbientLightConfig", addPlayerToggleField);
}

export function registerCanvasIconHooks() {
  Hooks.on("canvasReady", refreshLightSwitches);
  Hooks.on("canvasPan", refreshLightSwitches);
  Hooks.on("sightRefresh", refreshLightSwitches);
  Hooks.on("createAmbientLight", refreshLightSwitches);
  Hooks.on("updateAmbientLight", refreshLightSwitches);
  Hooks.on("deleteAmbientLight", refreshLightSwitches);
  Hooks.on("controlToken", refreshLightSwitches);
  Hooks.on("updateToken", refreshLightSwitches);
  Hooks.on("renderSceneControls", scheduleLightSwitchRefresh);
}
