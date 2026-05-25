import { MODULE_ID, QUERY_NAMES } from "./constants.js";
import { debugLog, debugNotify } from "./debug.js";
import { buildToggleUpdate, isToggleAllowed } from "./toggle.js";

const QUERY_TIMEOUT_MS = 5000;

// Registers the light toggle query socket handler in Foundry.
export function registerSocket() {
  CONFIG.queries[QUERY_NAMES.TOGGLE_LIGHT] = handleToggleLightQuery;
  debugLog("query registered", {
    query: QUERY_NAMES.TOGGLE_LIGHT,
    userId: game.user.id,
    isGM: game.user.isGM
  });
}

// Requests to toggle a light, either directly or via an active GM.
export async function requestLightToggle(light) {
  const ids = getLightRequestIds(light);

  if (!ids.sceneId || !ids.lightId) {
    debugNotify("light request missing ids", ids);
    return { ok: false, reason: "missing-ids" };
  }

  if (canUpdateLight(light)) return applyDirectToggle(light, ids.lightId);
  return queryActiveGM(ids);
}

// Finds an active GM to send the light toggle query.
async function queryActiveGM(payload) {
  const gm = getActiveGM();
  if (!gm) {
    debugNotify("no active GM for light query", payload);
    return { ok: false, reason: "no-active-gm" };
  }

  debugLog("query GM light toggle", { gmId: gm.id, payload });
  return sendToggleQuery(gm, payload);
}

// Sends the toggle request to the GM via socket and awaits response or timeout.
async function sendToggleQuery(gm, payload) {
  try {
    const result = await gm.query(QUERY_NAMES.TOGGLE_LIGHT, payload, { timeout: QUERY_TIMEOUT_MS });
    debugLog("GM light query result", { gmId: gm.id, result });
    return result;
  } catch (error) {
    debugNotify("GM light query failed", {
      sceneId: payload.sceneId,
      lightId: payload.lightId,
      message: error.message
    });
    return { ok: false, reason: "query-failed" };
  }
}

// Direct update path if player has immediate modification permissions.
async function applyDirectToggle(light, lightId) {
  const update = buildValidatedToggleUpdate(light, game.user, { allowGM: true });
  debugLog("direct update path", { lightId, update });
  if (!update) return { ok: false, reason: "rejected" };
  await light.update(update);
  return { ok: true, direct: true };
}

// GM-side socket handler that validates and executes the toggle request.
export async function handleToggleLightQuery(payload, { user } = {}) {
  logQueryReceived(payload, user);
  if (!game.user.isGM) return { ok: false, reason: "not-gm" };

  const { scene, light } = getSceneLight(payload?.sceneId, payload?.lightId);
  const update = buildValidatedToggleUpdate(light, user);

  if (!scene || !light || !update) {
    debugNotify("toggle light query rejected", getQueryRejectDebug(payload, scene, light, user));
    return { ok: false, reason: "rejected" };
  }

  await applyGMUpdate(scene, light, update);
  return { ok: true };
}

// Logs incoming socket query info for debugging.
function logQueryReceived(payload, user) {
  debugLog("toggle light query received", {
    payload,
    requesterId: user?.id,
    receiverId: game.user.id,
    isGM: game.user.isGM
  });
}

// Aggregates debug details when a toggle query is rejected.
function getQueryRejectDebug(payload, scene, light, user) {
  return {
    sceneId: payload?.sceneId,
    lightId: payload?.lightId,
    hasScene: Boolean(scene),
    hasLight: Boolean(light),
    hasUser: Boolean(user),
    userIsGM: user?.isGM
  };
}

// Performs the scene-level update to the AmbientLight document using GM permissions.
async function applyGMUpdate(scene, light, update) {
  debugNotify("GM applying light update", { sceneId: scene.id, lightId: light.id, update });
  await scene.updateEmbeddedDocuments("AmbientLight", [{ _id: light.id, ...update }]);
}

// Validates the toggle request based on user roles and document toggle permissions.
export function buildValidatedToggleUpdate(light, user, { allowGM = false } = {}) {
  if (!light || !user) return null;
  if (user.isGM && !allowGM) return null;
  if (!isToggleAllowed(light)) return null;
  return buildToggleUpdate(light);
}

// Finds the first active GM user in the session.
function getActiveGM() {
  return game.users.find((user) => user.active && user.isGM) ?? null;
}

// Checks if the current user has native Foundry permissions to modify the light.
function canUpdateLight(light) {
  return light?.canUserModify?.(game.user, "update") === true;
}

// Formats required IDs from a light document for the request.
function getLightRequestIds(light) {
  return {
    sceneId: light?.scene?.id ?? canvas.scene?.id,
    lightId: light?.id
  };
}

// Retrieves the scene and light documents from their respective IDs.
function getSceneLight(sceneId, lightId) {
  const scene = game.scenes.get(sceneId);
  const light = scene?.getEmbeddedDocument?.("AmbientLight", lightId)
    ?? scene?.lights?.get?.(lightId)
    ?? scene?.collections?.get("AmbientLight")?.get(lightId)
    ?? null;

  return {
    scene,
    light
  };
}
