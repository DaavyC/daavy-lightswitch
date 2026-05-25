import { createButtonBackground, createButtonIcon } from "./button-drawing.js";
import { MODULE_ID } from "./constants.js";
import { debugLog, debugNotify } from "./debug.js";
import { shouldShowForGM } from "./settings.js";
import { requestLightToggle } from "./socket.js";
import { isLightOff, isToggleAllowed } from "./toggle.js";

const HIT_SIZE = 42;
const SWITCH_LAYER_NAME = "daavyLightswitchLayer";

let switchLayer;
let canvasClickHandler;
let pendingRefresh = null;

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

export function scheduleLightSwitchRefresh() {
  if (pendingRefresh !== null) return;

  pendingRefresh = setTimeout(() => {
    pendingRefresh = null;
    refreshLightSwitches();
  }, 0);
}

export function refreshLightSwitches() {
  if (!globalThis.canvas?.ready || !globalThis.PIXI) {
    debugLog("refresh skipped", { canvasReady: globalThis.canvas?.ready, hasPixi: Boolean(globalThis.PIXI) });
    return;
  }

  const layer = prepareSwitchLayer();
  installCanvasClickHandler();

  if (shouldSkipRefresh()) return;
  renderSwitches(layer);
}

function renderSwitches(layer) {
  let rendered = 0;

  for (const placeable of canvas.lighting?.placeables ?? []) {
    if (!shouldShowSwitch(placeable)) continue;
    layer.addChild(createSwitchButton(placeable.document));
    rendered += 1;
  }

  debugLog("switches refreshed", {
    placeables: canvas.lighting?.placeables?.length ?? 0,
    rendered
  });
}

function prepareSwitchLayer() {
  ensureSwitchLayer();
  switchLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
  return switchLayer;
}

function shouldSkipRefresh() {
  if (isLightingControlsActive()) {
    debugLog("refresh skipped for lighting controls");
    return true;
  }

  if (game.user.isGM && !shouldShowForGM()) {
    debugLog("refresh skipped for GM");
    return true;
  }

  return false;
}

function ensureSwitchLayer() {
  if (switchLayer && !switchLayer.destroyed) return;

  switchLayer = new PIXI.Container();
  switchLayer.name = SWITCH_LAYER_NAME;
  switchLayer.eventMode = "passive";
  switchLayer.interactiveChildren = true;
  switchLayer.sortableChildren = true;
  switchLayer.zIndex = 10_000;

  const parent = canvas.stage;
  parent.sortableChildren = true;
  parent.addChild(switchLayer);
}

export function shouldShowSwitch(placeable) {
  const result = getSwitchVisibilityReason(placeable);
  debugLog("switch visibility checked", result);
  return result.visible;
}

export function getSwitchVisibilityReason(placeable) {
  const light = placeable?.document;
  const showAsGM = game.user.isGM && shouldShowForGM();

  if (!light) return { visible: false, reason: "missing-light" };
  if (isLightingControlsActive()) return { visible: false, reason: "lighting-controls-active", lightId: light.id };
  if (light.hidden && !isLightOff(light)) return { visible: false, reason: "hidden", lightId: light.id };
  if (!isToggleAllowed(light)) return { visible: false, reason: "toggle-disabled", lightId: light.id };
  if (showAsGM) return { visible: true, reason: "visible-for-gm", lightId: light.id };
  if (!canPlayerSeeLight(placeable)) return { visible: false, reason: "not-visible-to-player", lightId: light.id };
  return { visible: true, reason: "visible", lightId: light.id };
}

export function canPlayerSeeLight(placeable) {
  if (isInvisibleActiveLight(placeable)) return false;
  const visibility = canvas.visibility ?? canvas.effects?.visibility;

  if (typeof visibility?.testVisibility === "function") {
    return visibility.testVisibility(getLightPoint(placeable.document), getVisibilityOptions(placeable)) === true;
  }

  return true;
}

function isInvisibleActiveLight(placeable) {
  return !isLightOff(placeable.document) && (placeable.visible === false || placeable.renderable === false);
}

function getVisibilityOptions(placeable) {
  if (isLightOff(placeable.document)) return { tolerance: 0 };
  return { object: placeable, tolerance: 0 };
}

function getLightPoint(light) {
  return {
    x: light.x,
    y: light.y
  };
}

export function isLightingControlsActive() {
  return canvas?.lighting?.active === true || ui?.controls?.control?.name === "lighting";
}

function createSwitchButton(light) {
  const button = new PIXI.Container();
  const off = isLightOff(light);

  configureSwitchButton(button, light);
  button.addChild(createButtonBackground(off));
  button.addChild(createButtonIcon(off));
  button.on("pointerdown", (event) => handleSwitchPointerDown(event, light));

  return button;
}

function configureSwitchButton(button, light) {
  button.x = light.x;
  button.y = light.y;
  button.eventMode = "static";
  button.interactive = true;
  button.cursor = "pointer";
  button.hitArea = new PIXI.Rectangle(-HIT_SIZE / 2, -HIT_SIZE / 2, HIT_SIZE, HIT_SIZE);
  button.scale.set(getInverseCanvasScale());
}

function handleSwitchPointerDown(event, light) {
  event.preventDefault?.();
  event.stopPropagation();
  debugNotify("PIXI button clicked", { lightId: light.id });
  requestLightToggle(light).catch((error) => {
    console.error(`${MODULE_ID} | Failed to toggle light from PIXI button`, error);
  });
}

function installCanvasClickHandler() {
  const canvasElement = getCanvasElement();
  if (!canvasElement || canvasClickHandler) return;

  canvasClickHandler = (event) => {
    if (isLightingControlsActive()) return;
    if (game.user.isGM && !shouldShowForGM()) return;

    handleCanvasPointerDown(event);
  };

  canvasElement.addEventListener("pointerdown", canvasClickHandler, true);
}

function handleCanvasPointerDown(event) {
  const light = getLightAtClientPoint(event.clientX, event.clientY);
  debugLog("canvas pointerdown", {
    clientX: event.clientX,
    clientY: event.clientY,
    lightId: light?.id
  });

  if (!light) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  debugNotify("canvas click matched light", { lightId: light.id });
  requestLightToggle(light).catch((error) => {
    console.error(`${MODULE_ID} | Failed to toggle light`, error);
  });
}

function getCanvasElement() {
  return canvas.app?.canvas
    ?? canvas.app?.view
    ?? document.querySelector("#board canvas")
    ?? document.querySelector("canvas");
}

function getLightAtClientPoint(clientX, clientY) {
  let closestLight = null;
  let closestDistance = Infinity;

  for (const placeable of canvas.lighting?.placeables ?? []) {
    if (!shouldShowSwitch(placeable)) continue;

    const candidate = getClickCandidate(placeable, clientX, clientY);
    if (!isCloserHit(candidate, closestDistance)) continue;

    closestLight = placeable.document;
    closestDistance = candidate.distance;
  }

  return closestLight;
}

function getClickCandidate(placeable, clientX, clientY) {
  const point = getClientPosition(placeable.document);
  const distance = Math.hypot(clientX - point.x, clientY - point.y);

  debugLog("candidate light distance", {
    lightId: placeable.document.id,
    clientX,
    clientY,
    point,
    distance,
    hitRadius: HIT_SIZE / 2
  });

  return { distance };
}

function isCloserHit(candidate, closestDistance) {
  return candidate.distance <= HIT_SIZE / 2 && candidate.distance < closestDistance;
}

function getClientPosition(light) {
  const canvasElement = getCanvasElement();
  const rect = canvasElement?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
  const point = canvas.stage.worldTransform.apply({
    x: light.x,
    y: light.y
  });

  return {
    x: rect.left + point.x,
    y: rect.top + point.y
  };
}

export { createButtonIcon };

function getInverseCanvasScale() {
  const scale = canvas.stage?.scale?.x || 1;
  return 1 / scale;
}
