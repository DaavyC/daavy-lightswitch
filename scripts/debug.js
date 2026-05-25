import { isTruthyValue } from "./booleans.js";
import { FLAGS, MODULE_ID, QUERY_NAMES } from "./constants.js";
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

  return {
    user: getUserSnapshot(),
    scene: getSceneSnapshot(),
    canvasReady: canvas.ready,
    query: QUERY_NAMES.TOGGLE_LIGHT,
    switchLayer: {
      exists: Boolean(layer),
      childCount: layer?.children?.length ?? 0
    },
    lights: getLightSnapshots()
  };
}

function getUserSnapshot() {
  return {
    id: game.user.id,
    name: game.user.name,
    isGM: game.user.isGM
  };
}

function getSceneSnapshot() {
  return {
    id: canvas.scene?.id,
    name: canvas.scene?.name
  };
}

function getLightSnapshots() {
  return Array.from(canvas?.lighting?.placeables ?? []).map(getLightSnapshot);
}

function getLightSnapshot(placeable) {
  const light = placeable.document;
  const toggleFlag = light.getFlag(MODULE_ID, FLAGS.PLAYER_TOGGLE_ENABLED);

  return {
    id: light.id,
    x: light.x,
    y: light.y,
    hidden: light.hidden,
    visible: placeable.visible,
    renderable: placeable.renderable,
    toggleAllowed: isTruthyValue(toggleFlag),
    isOff: light.getFlag(MODULE_ID, FLAGS.IS_OFF) === true,
    flag: toggleFlag
  };
}

function findSwitchLayer() {
  return canvas?.stage?.children?.find((child) => child.name === "daavyLightswitchLayer");
}
