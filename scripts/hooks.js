import { MODULE_ID } from "./constants.js";
import { injectFeedbackButton } from "./feedback.js";
import { organizeSettingsConfig, registerSettings } from "./settings.js";

export function registerHooks({
  addCircuitTool,
  addPlayerToggleField,
  normalizePlayerToggleFlag,
  refreshCircuitLines,
  refreshLightSwitches,
  registerSocket,
  scheduleCanvasRefresh,
  setDefaultPlayerToggleFlag
}) {
  Hooks.on("getSceneControlButtons", addCircuitTool);
  Hooks.on("renderSettingsConfig", (app, html) => {
    organizeSettingsConfig(app, html);
    injectFeedbackButton(html);
  });
  Hooks.once("init", onInit);
  Hooks.once("ready", onReady);

  function onInit() {
    registerSettings(refreshLightSwitches);
  }

  function onReady() {
    registerSocket();
    Hooks.on("preCreateAmbientLight", setDefaultPlayerToggleFlag);
    Hooks.on("preUpdateAmbientLight", normalizePlayerToggleFlag);
    Hooks.on("renderAmbientLightConfig", addPlayerToggleField);
    Hooks.on("canvasReady", refreshCanvas);
    Hooks.on("canvasPan", refreshCanvas);
    Hooks.on("sightRefresh", refreshLightSwitches);
    Hooks.on("createAmbientLight", refreshAmbientLight);
    Hooks.on("updateAmbientLight", refreshAmbientLight);
    Hooks.on("deleteAmbientLight", refreshAmbientLight);
    Hooks.on("controlToken", refreshLightSwitches);
    Hooks.on("updateToken", refreshLightSwitches);
    Hooks.on("renderSceneControls", scheduleCanvasRefresh);
    Hooks.on("updateScene", scheduleCanvasRefresh);
    console.info(`${MODULE_ID} | Ready`);
  }

  function refreshCanvas() {
    refreshLightSwitches();
    refreshCircuitLines();
  }

  function refreshAmbientLight() {
    scheduleCanvasRefresh();
  }
}
