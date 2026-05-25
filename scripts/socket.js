import { MODULE_ID, QUERY_NAMES } from "./constants.js";
import { debugLog, debugNotify } from "./debug.js";
import { buildToggleUpdate, isToggleAllowed } from "./toggle.js";

const QUERY_TIMEOUT_MS = 5000;

export function registerSocket() {
  CONFIG.queries[QUERY_NAMES.TOGGLE_LIGHT] = handleToggleLightQuery;
  debugLog("query registered", {
    query: QUERY_NAMES.TOGGLE_LIGHT,
    userId: game.user.id,
    isGM: game.user.isGM
  });
}

export async function requestLightToggle(light) {
  const ids = getLightRequestIds(light);

  if (!ids.sceneId || !ids.lightId) {
    debugNotify("light request missing ids", ids);
    return { ok: false, reason: "missing-ids" };
  }

  if (canUpdateLight(light)) return applyDirectToggle(light, ids.lightId);
  return queryActiveGM(ids);
}

async function queryActiveGM(payload) {
  const gm = getActiveGM();
  if (!gm) {
    debugNotify("no active GM for light query", payload);
    return { ok: false, reason: "no-active-gm" };
  }

  debugLog("query GM light toggle", { gmId: gm.id, payload });
  return sendToggleQuery(gm, payload);
}

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

async function applyDirectToggle(light, lightId) {
  const update = buildValidatedToggleUpdate(light, game.user, { allowGM: true });
  debugLog("direct update path", { lightId, update });
  if (!update) return { ok: false, reason: "rejected" };
  await light.update(update);
  return { ok: true, direct: true };
}

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

function logQueryReceived(payload, user) {
  debugLog("toggle light query received", {
    payload,
    requesterId: user?.id,
    receiverId: game.user.id,
    isGM: game.user.isGM
  });
}

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

async function applyGMUpdate(scene, light, update) {
  debugNotify("GM applying light update", { sceneId: scene.id, lightId: light.id, update });
  await scene.updateEmbeddedDocuments("AmbientLight", [{ _id: light.id, ...update }]);
}

export function buildValidatedToggleUpdate(light, user, { allowGM = false } = {}) {
  if (!light || !user) return null;
  if (user.isGM && !allowGM) return null;
  if (!isToggleAllowed(light)) return null;
  return buildToggleUpdate(light);
}

function getActiveGM() {
  return game.users.find((user) => user.active && user.isGM) ?? null;
}

function canUpdateLight(light) {
  return light?.canUserModify?.(game.user, "update") === true;
}

function getLightRequestIds(light) {
  return {
    sceneId: light?.scene?.id ?? canvas.scene?.id,
    lightId: light?.id
  };
}

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
