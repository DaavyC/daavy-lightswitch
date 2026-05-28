import { FLAGS, MODULE_ID, QUERY_NAMES, SETTINGS, SWITCH_LAYER_NAME } from "./config.js";
import { isTruthyValue } from "./utils.js";

export function isDebugEnabled() {
  if (typeof game === "undefined") return false;
  return game.settings.get(MODULE_ID, SETTINGS.DEBUG) === true;
}

export function debugLog(message, data = {}) {
  if (!isDebugEnabled()) return;
  writeDebugLog(message, data);
}

export function debugNotify(message, data = {}) {
  if (!isDebugEnabled()) return;
  writeDebugLog(message, data);
  ui.notifications?.info(`${MODULE_ID} DEBUG | ${message}`, { permanent: false });
}

function writeDebugLog(message, data) {
  console.warn(`${MODULE_ID} | DEBUG | ${message}`, data);
}

export function reportToggleError(message, error) {
  console.error(`${MODULE_ID} | ${message}`, error);
}

export function getQueryRejectDebug(payload, scene, light, user) {
  return {
    sceneId: payload?.sceneId,
    lightId: payload?.lightId,
    hasScene: Boolean(scene),
    hasLight: Boolean(light),
    hasUser: Boolean(user),
    userIsGM: user?.isGM
  };
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
  return canvas?.stage?.children?.find((child) => child.name === SWITCH_LAYER_NAME);
}
