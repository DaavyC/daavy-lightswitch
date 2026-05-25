import { MODULE_ID, QUERY_NAMES } from "./constants.js";
import { debugLog, debugNotify } from "./debug.js";
import { buildLightOffUpdate, buildToggleUpdate, isToggleAllowed } from "./toggle.js";

const QUERY_TIMEOUT_MS = 5000;

export function registerSocket() {
  CONFIG.queries[QUERY_NAMES.TOGGLE_LIGHT] = handleToggleLightQuery;
  debugLog("query registered", {
    query: QUERY_NAMES.TOGGLE_LIGHT,
    userId: game.user.id,
    isGM: game.user.isGM
  });
}

export async function requestLightTurnOff(light) {
  return requestLightAction(light, buildValidatedLightOffUpdate);
}

export async function requestLightToggle(light) {
  return requestLightAction(light, buildValidatedToggleUpdate);
}

async function requestLightAction(light, buildDirectUpdate) {
  const sceneId = light?.scene?.id ?? canvas.scene?.id;
  const lightId = light?.id;

  if (!sceneId || !lightId) {
    debugNotify("light request missing ids", { sceneId, lightId });
    return { ok: false, reason: "missing-ids" };
  }

  if (canUpdateLight(light)) {
    const update = buildDirectUpdate(light, game.user, { allowGM: true });
    debugLog("direct update path", { lightId, update });
    if (!update) return { ok: false, reason: "rejected" };
    await light.update(update);
    return { ok: true, direct: true };
  }

  const gm = getActiveGM();
  if (!gm) {
    debugNotify("no active GM for light query", { sceneId, lightId });
    return { ok: false, reason: "no-active-gm" };
  }

  const payload = {
    sceneId,
    lightId
  };

  debugLog("query GM light toggle", { gmId: gm.id, payload });

  try {
    const result = await gm.query(QUERY_NAMES.TOGGLE_LIGHT, payload, { timeout: QUERY_TIMEOUT_MS });
    debugLog("GM light query result", { gmId: gm.id, result });
    return result;
  } catch (error) {
    debugNotify("GM light query failed", {
      sceneId,
      lightId,
      message: error.message
    });
    return { ok: false, reason: "query-failed" };
  }
}

export async function handleToggleLightQuery(payload, { user } = {}) {
  debugLog("toggle light query received", {
    payload,
    requesterId: user?.id,
    receiverId: game.user.id,
    isGM: game.user.isGM
  });

  if (!game.user.isGM) return { ok: false, reason: "not-gm" };

  const { scene, light } = getSceneLight(payload?.sceneId, payload?.lightId);
  const update = buildValidatedToggleUpdate(light, user);

  if (!scene || !light || !update) {
    debugNotify("toggle light query rejected", {
      sceneId: payload?.sceneId,
      lightId: payload?.lightId,
      hasScene: Boolean(scene),
      hasLight: Boolean(light),
      hasUser: Boolean(user),
      userIsGM: user?.isGM
    });
    return { ok: false, reason: "rejected" };
  }

  debugNotify("GM applying light update", {
    sceneId: scene.id,
    lightId: light.id,
    update
  });

  await scene.updateEmbeddedDocuments("AmbientLight", [
    {
      _id: light.id,
      ...update
    }
  ]);

  return { ok: true };
}

export function buildValidatedLightOffUpdate(light, user, { allowGM = false } = {}) {
  if (!light || !user) return null;
  if (user.isGM && !allowGM) return null;
  return buildLightOffUpdate(light);
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
