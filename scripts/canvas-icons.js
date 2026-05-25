import { MODULE_ID } from "./constants.js";
import { debugLog, debugNotify } from "./debug.js";
import { shouldShowForGM } from "./settings.js";
import { requestLightToggle } from "./socket.js";
import { isLightOff, isToggleAllowed } from "./toggle.js";

const SWITCH_SIZE = 28;
const HIT_SIZE = 42;
const SWITCH_LAYER_NAME = "daavyLightswitchLayer";

let switchLayer;
let canvasClickHandler;

export function registerCanvasIconHooks() {
  Hooks.on("canvasReady", refreshLightSwitches);
  Hooks.on("canvasPan", refreshLightSwitches);
  Hooks.on("sightRefresh", refreshLightSwitches);
  Hooks.on("createAmbientLight", refreshLightSwitches);
  Hooks.on("updateAmbientLight", refreshLightSwitches);
  Hooks.on("deleteAmbientLight", refreshLightSwitches);
  Hooks.on("controlToken", refreshLightSwitches);
  Hooks.on("updateToken", refreshLightSwitches);
}

export function refreshLightSwitches() {
  if (!canvas?.ready || !globalThis.PIXI) {
    debugLog("refresh skipped", { canvasReady: canvas?.ready, hasPixi: Boolean(globalThis.PIXI) });
    return;
  }

  ensureSwitchLayer();
  installCanvasClickHandler();
  switchLayer.removeChildren().forEach((child) => child.destroy({ children: true }));

  if (game.user.isGM && !shouldShowForGM()) {
    debugLog("refresh skipped for GM");
    return;
  }

  let rendered = 0;

  for (const placeable of canvas.lighting?.placeables ?? []) {
    if (!shouldShowSwitch(placeable)) continue;
    switchLayer.addChild(createSwitchButton(placeable.document));
    rendered += 1;
  }

  debugLog("switches refreshed", {
    placeables: canvas.lighting?.placeables?.length ?? 0,
    rendered
  });
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
  const light = placeable?.document;
  const result = getSwitchVisibilityReason(placeable);
  debugLog("switch visibility checked", result);
  return result.visible;
}

export function getSwitchVisibilityReason(placeable) {
  const light = placeable?.document;
  const showAsGM = game.user.isGM && shouldShowForGM();

  if (!light) return { visible: false, reason: "missing-light" };
  if (light.hidden && !isLightOff(light)) return { visible: false, reason: "hidden", lightId: light.id };
  if (!isToggleAllowed(light)) return { visible: false, reason: "toggle-disabled", lightId: light.id };
  if (showAsGM) return { visible: true, reason: "visible-for-gm", lightId: light.id };
  if (!canPlayerSeeLight(placeable)) return { visible: false, reason: "not-visible-to-player", lightId: light.id };
  return { visible: true, reason: "visible", lightId: light.id };
}

export function canPlayerSeeLight(placeable) {
  if (!isLightOff(placeable.document) && (placeable.visible === false || placeable.renderable === false)) {
    return false;
  }

  const point = {
    x: placeable.document.x,
    y: placeable.document.y
  };
  const visibility = canvas.visibility ?? canvas.effects?.visibility;

  if (typeof visibility?.testVisibility === "function") {
    const options = isLightOff(placeable.document)
      ? { tolerance: 0 }
      : { object: placeable, tolerance: 0 };

    return visibility.testVisibility(point, options) === true;
  }

  return true;
}

function createSwitchButton(light) {
  const button = new PIXI.Container();
  const off = isLightOff(light);

  button.x = light.x;
  button.y = light.y;
  button.eventMode = "static";
  button.interactive = true;
  button.cursor = "pointer";
  button.hitArea = new PIXI.Rectangle(-HIT_SIZE / 2, -HIT_SIZE / 2, HIT_SIZE, HIT_SIZE);
  button.scale.set(getInverseCanvasScale());

  button.addChild(createButtonBackground(off));
  button.addChild(createButtonIcon(off));
  button.on("pointerdown", (event) => {
    event.preventDefault?.();
    event.stopPropagation();
    debugNotify("PIXI button clicked", { lightId: light.id });
    requestLightToggle(light).catch((error) => {
      console.error(`${MODULE_ID} | Failed to toggle light from PIXI button`, error);
    });
  });

  return button;
}

function installCanvasClickHandler() {
  const canvasElement = getCanvasElement();
  if (!canvasElement || canvasClickHandler) return;

  canvasClickHandler = (event) => {
    if (game.user.isGM && !shouldShowForGM()) return;

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
  };

  canvasElement.addEventListener("pointerdown", canvasClickHandler, true);
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

    if (distance <= HIT_SIZE / 2 && distance < closestDistance) {
      closestLight = placeable.document;
      closestDistance = distance;
    }
  }

  return closestLight;
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

function createButtonBackground(off) {
  const graphics = new PIXI.Graphics();

  if (typeof graphics.circle === "function") {
    graphics
      .circle(0, 0, SWITCH_SIZE / 2)
      .fill({ color: off ? 0x2c2c2c : 0x1e1e1e, alpha: 0.88 })
      .stroke({ color: off ? 0xb8b8b8 : 0xffd76a, alpha: 0.95, width: 2 });
  } else {
    graphics.beginFill(off ? 0x2c2c2c : 0x1e1e1e, 0.88);
    graphics.lineStyle(2, off ? 0xb8b8b8 : 0xffd76a, 0.95);
    graphics.drawCircle(0, 0, SWITCH_SIZE / 2);
    graphics.endFill();
  }

  return graphics;
}

function createButtonIcon(off) {
  const style = {
    fill: off ? 0xb8b8b8 : 0xffd76a,
    fontFamily: "Arial",
    fontSize: 18,
    fontWeight: "700"
  };
  const text = createPixiText(off ? "○" : "●", style);

  text.anchor.set(0.5);
  return text;
}

function createPixiText(text, style) {
  return new PIXI.Text(text, style);
}

function getInverseCanvasScale() {
  const scale = canvas.stage?.scale?.x || 1;
  return 1 / scale;
}
