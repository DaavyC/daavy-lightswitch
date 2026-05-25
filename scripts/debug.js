import { isTruthyValue } from "./booleans.js";
import { FLAGS, MODULE_ID, QUERY_NAMES } from "./constants.js";
import { isDebugEnabled } from "./settings.js";

// Logs a debug warning to the console if debug mode is active.
export function debugLog(message, data = {}) {
  if (!isDebugEnabled()) return;
  console.warn(`${MODULE_ID} | DEBUG | ${message}`, data);
}

// Displays an in-game notification and logs to the console if debug mode is active.
export function debugNotify(message, data = {}) {
  debugLog(message, data);
  if (!isDebugEnabled()) return;
  ui.notifications?.info(`${MODULE_ID} DEBUG | ${message}`, { permanent: false });
}

// Exposes the debug API on the global scope for external access.
export function registerDebugApi() {
  globalThis.DaavyLightswitchDebug = {
    snapshot
  };
}

// Generates a snapshot of the current state (user, scene, switches layer, and lights) for debugging.
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

// Retrieves basic information of the current user for debugging.
function getUserSnapshot() {
  return {
    id: game.user.id,
    name: game.user.name,
    isGM: game.user.isGM
  };
}

// Retrieves basic information of the active scene for debugging.
function getSceneSnapshot() {
  return {
    id: canvas.scene?.id,
    name: canvas.scene?.name
  };
}

// Retrieves debug snapshots of all light placeables on the canvas.
function getLightSnapshots() {
  return Array.from(canvas?.lighting?.placeables ?? []).map(getLightSnapshot);
}

// Generates the detailed debug state for a specific light.
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

// Locates the PIXI layer container used to render light switches.
function findSwitchLayer() {
  return canvas?.stage?.children?.find((child) => child.name === "daavyLightswitchLayer");
}
