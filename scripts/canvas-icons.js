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

  ensureSwitchLayer();
  installCanvasClickHandler();
  switchLayer.removeChildren().forEach((child) => child.destroy({ children: true }));

  if (isLightingControlsActive()) {
    debugLog("refresh skipped for lighting controls");
    return;
  }

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
  if (isLightingControlsActive()) return { visible: false, reason: "lighting-controls-active", lightId: light.id };
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

export function isLightingControlsActive() {
  return canvas?.lighting?.active === true || ui?.controls?.control?.name === "lighting";
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
    if (isLightingControlsActive()) return;
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

export function createButtonIcon(off) {
  const icon = new PIXI.Graphics();
  const glassColor = off ? 0x777777 : 0xffd76a;
  const glassStroke = off ? 0xb8b8b8 : 0xfff0a3;
  const baseColor = off ? 0x555555 : 0x8d7840;
  const baseStroke = off ? 0xa0a0a0 : 0xffd76a;

  if (!off) {
    drawCircle(icon, 0, -3, 11, 0xffd76a, 0.16);
    drawCircle(icon, 0, -3, 7, 0xffe8a0, 0.2);
  }

  drawEllipse(icon, 0, -5, 7, 8, glassColor, off ? 0.42 : 0.95, glassStroke, 1.6, off ? 0.85 : 0.95);
  drawPolygon(icon, [-4, 2, 4, 2, 3, 6, -3, 6], glassColor, off ? 0.42 : 0.86, glassStroke, 1.2, off ? 0.7 : 0.85);

  if (!off) {
    drawLine(icon, [-3, -4, -1, -1, 1, -4, 3, -1], 0x7a5a00, 1.25, 0.72);
    drawCircle(icon, -2.6, -8.2, 1.5, 0xffffff, 0.58);
  }

  drawRoundedRect(icon, -4.8, 5, 9.6, 4.2, 1.2, baseColor, 0.95, baseStroke, 1.1, 0.86);
  drawLine(icon, [-3.4, 6.5, 3.4, 6.5], off ? 0xb8b8b8 : 0xffef9b, 0.9, 0.72);
  drawRoundedRect(icon, -3.4, 9, 6.8, 2.3, 0.8, baseColor, 0.9, baseStroke, 0.8, 0.7);

  return icon;
}

function getInverseCanvasScale() {
  const scale = canvas.stage?.scale?.x || 1;
  return 1 / scale;
}

function drawCircle(graphics, x, y, radius, fillColor, fillAlpha, strokeColor, strokeWidth = 0, strokeAlpha = 1) {
  if (typeof graphics.circle === "function") {
    graphics.circle(x, y, radius).fill({ color: fillColor, alpha: fillAlpha });
    if (strokeColor !== undefined && strokeWidth > 0) {
      graphics.stroke({ color: strokeColor, alpha: strokeAlpha, width: strokeWidth });
    }
    return;
  }

  graphics.beginFill(fillColor, fillAlpha);
  if (strokeColor !== undefined && strokeWidth > 0) {
    graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
  }
  graphics.drawCircle(x, y, radius);
  graphics.endFill();
}

function drawEllipse(graphics, x, y, width, height, fillColor, fillAlpha, strokeColor, strokeWidth, strokeAlpha) {
  if (typeof graphics.ellipse === "function") {
    graphics
      .ellipse(x, y, width, height)
      .fill({ color: fillColor, alpha: fillAlpha })
      .stroke({ color: strokeColor, alpha: strokeAlpha, width: strokeWidth });
    return;
  }

  graphics.beginFill(fillColor, fillAlpha);
  graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
  graphics.drawEllipse(x, y, width, height);
  graphics.endFill();
}

function drawRoundedRect(graphics, x, y, width, height, radius, fillColor, fillAlpha, strokeColor, strokeWidth, strokeAlpha) {
  if (typeof graphics.roundRect === "function") {
    graphics
      .roundRect(x, y, width, height, radius)
      .fill({ color: fillColor, alpha: fillAlpha })
      .stroke({ color: strokeColor, alpha: strokeAlpha, width: strokeWidth });
    return;
  }

  graphics.beginFill(fillColor, fillAlpha);
  graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
  graphics.drawRoundedRect(x, y, width, height, radius);
  graphics.endFill();
}

function drawPolygon(graphics, points, fillColor, fillAlpha, strokeColor, strokeWidth, strokeAlpha) {
  if (typeof graphics.poly === "function") {
    graphics
      .poly(points)
      .fill({ color: fillColor, alpha: fillAlpha })
      .stroke({ color: strokeColor, alpha: strokeAlpha, width: strokeWidth });
    return;
  }

  graphics.beginFill(fillColor, fillAlpha);
  graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
  graphics.drawPolygon(points);
  graphics.endFill();
}

function drawLine(graphics, points, color, width, alpha) {
  if (typeof graphics.moveTo === "function" && typeof graphics.stroke === "function") {
    graphics.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) {
      graphics.lineTo(points[index], points[index + 1]);
    }
    graphics.stroke({ color, alpha, width });
    return;
  }

  graphics.lineStyle(width, color, alpha);
  graphics.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    graphics.lineTo(points[index], points[index + 1]);
  }
}
