import { MODULE_ID } from "./constants.js";
import { isDebugEnabled } from "./settings.js";

export function debugLog(message, data = {}) {
  if (!isDebugEnabled()) return;
  console.warn(`${MODULE_ID} | DEBUG | ${message}`, data);
}

export function debugNotify(message, data = {}) {
  debugLog(message, data);
  if (!isDebugEnabled()) return;
  ui.notifications?.info(`${MODULE_ID} DEBUG | ${message}`, { permanent: false });
}

export function registerDebugApi() {
  globalThis.DaavyLightswitchDebug = {
    snapshot
  };
}

function snapshot() {
  const layer = findSwitchLayer();
  const lights = Array.from(canvas?.lighting?.placeables ?? []).map((placeable) => ({
    id: placeable.document.id,
    x: placeable.document.x,
    y: placeable.document.y,
    hidden: placeable.document.hidden,
    visible: placeable.visible,
    renderable: placeable.renderable,
    toggleAllowed: isFlagTruthy(placeable.document.getFlag(MODULE_ID, "playerToggleEnabled")),
    isOff: placeable.document.getFlag(MODULE_ID, "isOff") === true,
    flag: placeable.document.getFlag(MODULE_ID, "playerToggleEnabled")
  }));

  return {
    user: {
      id: game.user.id,
      name: game.user.name,
      isGM: game.user.isGM
    },
    scene: {
      id: canvas.scene?.id,
      name: canvas.scene?.name
    },
    canvasReady: canvas.ready,
    socket: `module.${MODULE_ID}`,
    switchLayer: {
      exists: Boolean(layer),
      childCount: layer?.children?.length ?? 0
    },
    lights
  };
}

function findSwitchLayer() {
  return canvas?.stage?.children?.find((child) => child.name === "daavyLightswitchLayer");
}

function isFlagTruthy(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "on";
}
