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
  Hooks.on("renderSettingsConfig", organizeSettingsConfig);
  Hooks.once("init", onInit);
  Hooks.once("ready", onReady);
}

function onInit() {
  registerSettings();
}

function onReady() {
  registerSocket();
  Hooks.on("preCreateAmbientLight", setDefaultPlayerToggleFlag);
  Hooks.on("preUpdateAmbientLight", normalizePlayerToggleFlag);
  Hooks.on("renderAmbientLightConfig", addPlayerToggleField);
  Hooks.on("canvasReady", refreshLightSwitches);
  Hooks.on("canvasPan", refreshLightSwitches);
  Hooks.on("sightRefresh", refreshLightSwitches);
  Hooks.on("createAmbientLight", refreshLightSwitches);
  Hooks.on("updateAmbientLight", refreshLightSwitches);
  Hooks.on("deleteAmbientLight", refreshLightSwitches);
  Hooks.on("controlToken", refreshLightSwitches);
  Hooks.on("updateToken", refreshLightSwitches);
  Hooks.on("renderSceneControls", scheduleLightSwitchRefresh);
  console.info(`${MODULE_ID} | Ready`);
}
